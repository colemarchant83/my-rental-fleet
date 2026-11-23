const ALLOWED = new Set([
  'https://my-rental-fleet.web.app',
  'https://my-rental-fleet.firebaseapp.com',
  'https://my-rental-fleet.com',
  'https://www.my-rental-fleet.com',
]);

function safeKey(raw) {
  const key = decodeURIComponent(raw || '').replace(/^\/+/, '');
  if (!key || key.includes('..') || !/^[\w./-]+$/.test(key)) return null;
  return key;
}

function cors(origin) {
  const allow = ALLOWED.has(origin) ? origin : 'https://my-rental-fleet.web.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'PUT, GET, HEAD, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
  };
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function deleteOldRentalMedia(env) {
  const cutoff = new Date(Date.now() - YEAR_MS);
  const marker = await env.BUCKET.get('maintenance/cleanup-cursor');
  const saved = marker ? await marker.text() : '';
  const [savedPrefix, savedCursor] = saved.split('\n');
  const prefixes = ['rentals/', 'captures/'];
  let prefixIndex = Math.max(0, prefixes.indexOf(savedPrefix));
  let cursor = savedCursor || undefined;
  let examined = 0;
  let removed = 0;
  while (prefixIndex < prefixes.length && examined < 2000) {
    const listed = await env.BUCKET.list({ prefix: prefixes[prefixIndex], cursor, limit: 200 });
    for (const object of listed.objects) {
      examined += 1;
      if (object.uploaded < cutoff) {
        await env.BUCKET.delete(object.key);
        removed += 1;
      }
    }
    if (listed.truncated) {
      cursor = listed.cursor;
    } else {
      prefixIndex += 1;
      cursor = undefined;
    }
  }
  const finished = prefixIndex >= prefixes.length;
  await env.BUCKET.put('maintenance/cleanup-cursor', finished ? '' : `${prefixes[prefixIndex]}\n${cursor || ''}`);
  return removed;
}

function byteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = match[1] === '' ? undefined : Number(match[1]);
  const end = match[2] === '' ? undefined : Number(match[2]);
  if (start === undefined && end === undefined) return null;
  if (start === undefined) return { suffix: Math.min(end, size) };
  if (start >= size || (end !== undefined && end < start)) return 'unsatisfiable';
  const last = end === undefined || end >= size ? size - 1 : end;
  return { offset: start, length: last - start + 1 };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(deleteOldRentalMedia(env));
  },
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (request.method === 'GET' && url.pathname === '/upload/start') {
      return Response.json({ ok: true }, { headers: cors(origin) });
    }

    if (request.method === 'POST' && url.pathname === '/upload/start') {
      const key = safeKey(url.searchParams.get('key') || '');
      if (!key) return new Response('Bad key', { status: 400, headers: cors(origin) });
      const upload = await env.BUCKET.createMultipartUpload(key, {
        httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
      });
      return Response.json({ uploadId: upload.uploadId }, { headers: cors(origin) });
    }

    if (request.method === 'PUT' && url.pathname === '/upload/part') {
      const key = safeKey(url.searchParams.get('key') || '');
      const uploadId = url.searchParams.get('uploadId') || '';
      const partNumber = Number(url.searchParams.get('part') || '');
      if (!key || !uploadId || !partNumber) return new Response('Bad part', { status: 400, headers: cors(origin) });
      const upload = env.BUCKET.resumeMultipartUpload(key, uploadId);
      const part = await upload.uploadPart(partNumber, request.body);
      return Response.json({ partNumber: part.partNumber, etag: part.etag }, { headers: cors(origin) });
    }

    if (request.method === 'POST' && url.pathname === '/upload/finish') {
      const key = safeKey(url.searchParams.get('key') || '');
      const uploadId = url.searchParams.get('uploadId') || '';
      if (!key || !uploadId) return new Response('Bad finish', { status: 400, headers: cors(origin) });
      const parts = await request.json();
      const upload = env.BUCKET.resumeMultipartUpload(key, uploadId);
      await upload.complete(parts);
      return new Response(`${url.origin}/media/${key}`, {
        status: 200,
        headers: { ...cors(origin), 'Content-Type': 'text/plain' },
      });
    }

    if (request.method === 'PUT' && url.pathname === '/upload') {
      const key = safeKey(url.searchParams.get('key') || '');
      if (!key) return new Response('Bad key', { status: 400, headers: cors(origin) });
      await env.BUCKET.put(key, request.body, {
        httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
      });
      return new Response(`${url.origin}/media/${key}`, {
        status: 200,
        headers: { ...cors(origin), 'Content-Type': 'text/plain' },
      });
    }

    if ((request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE') && url.pathname.startsWith('/media/')) {
      const key = safeKey(url.pathname.slice('/media/'.length));
      if (!key) return new Response('Bad key', { status: 400, headers: cors(origin) });
      if (request.method === 'DELETE') {
        await env.BUCKET.delete(key);
        return new Response('Deleted', { status: 200, headers: cors(origin) });
      }
      const head = await env.BUCKET.head(key);
      if (!head) return new Response('Not found', { status: 404, headers: cors(origin) });
      const requested = request.headers.get('Range');
      const range = byteRange(requested, head.size);
      if (range === 'unsatisfiable') {
        return new Response(null, {
          status: 416,
          headers: { ...cors(origin), 'Content-Range': `bytes */${head.size}` },
        });
      }
      const object = await env.BUCKET.get(key, range ? { range } : undefined);
      if (!object) return new Response('Not found', { status: 404, headers: cors(origin) });
      // A full file must be 200. Marking it 206 makes the iPhone refuse to play and makes Android stop partway through.
      const span = requested && object.range ? object.range : null;
      const status = span ? 206 : 200;
      const length = span ? span.length : object.size;
      const headers = {
        ...cors(origin),
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      };
      if (span) headers['Content-Range'] = `bytes ${span.offset}-${span.offset + span.length - 1}/${object.size}`;
      if (request.method === 'HEAD') return new Response(null, { status, headers });
      return new Response(object.body, { status, headers });
    }

    return new Response('Not found', { status: 404, headers: cors(origin) });
  },
};
