const ALLOWED = new Set([
  'https://my-rental-fleet.web.app',
  'https://my-rental-fleet.firebaseapp.com',
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
    'Access-Control-Allow-Methods': 'PUT, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
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

    if ((request.method === 'GET' || request.method === 'DELETE') && url.pathname.startsWith('/media/')) {
      const key = safeKey(url.pathname.slice('/media/'.length));
      if (!key) return new Response('Bad key', { status: 400, headers: cors(origin) });
      if (request.method === 'DELETE') {
        await env.BUCKET.delete(key);
        return new Response('Deleted', { status: 200, headers: cors(origin) });
      }
      const object = await env.BUCKET.get(key);
      if (!object) return new Response('Not found', { status: 404, headers: cors(origin) });
      return new Response(object.body, {
        headers: {
          ...cors(origin),
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new Response('Not found', { status: 404, headers: cors(origin) });
  },
};
