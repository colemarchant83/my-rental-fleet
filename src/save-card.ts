import { SPOTS, clocksDisagree, formatDay, formatStamp, loadCachedVehicles, type InspectionSide, type LocalRental } from './fleet-store';
import { readStoredBlob } from './media';

type SavedFile = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(items: SavedFile[]) {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const item of items) {
    const name = encoder.encode(item.name);
    const crc = crc32(item.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, item.data.length, true);
    view.setUint32(22, item.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local as BlobPart, item.data as BlobPart);
    const header = new Uint8Array(46 + name.length);
    const centralView = new DataView(header.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, item.data.length, true);
    centralView.setUint32(24, item.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    header.set(name, 46);
    central.push(header);
    offset += local.length + item.data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, items.length, true);
  endView.setUint16(10, items.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...parts, ...(central as BlobPart[]), end], { type: 'application/zip' });
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[char] || char);
}

function safeName(value: string) {
  return value.replace(/[^\w.-]+/g, ' ').trim().replace(/\s+/g, ' ') || 'Rental';
}

function extFor(blob: Blob, fallback: string) {
  if (blob.type.includes('png')) return 'png';
  if (blob.type.includes('webp')) return 'webp';
  if (blob.type.includes('mp4') || blob.type.includes('video')) return 'mp4';
  return fallback;
}

async function mediaBlob(localUri?: string, remoteUrl?: string) {
  if (localUri?.startsWith('idb:')) {
    const stored = await readStoredBlob(localUri).catch(() => null);
    if (stored) return stored;
  }
  const direct = [localUri, remoteUrl].find((uri) => !!uri && (uri.startsWith('http') || uri.startsWith('blob:') || uri.startsWith('data:')));
  if (!direct) return null;
  const response = await fetch(direct).catch(() => null);
  if (!response?.ok) return null;
  return response.blob();
}

async function asBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function bytesToDataUrl(data: Uint8Array, mime: string) {
  let binary = '';
  for (let index = 0; index < data.length; index += 8192) {
    binary += String.fromCharCode(...data.subarray(index, index + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function clockLines(phone?: string, server?: string, fallback?: string, file?: string) {
  const serverText = server ? `Server ${formatStamp(server)}` : fallback ? `Server ${formatStamp(fallback)}` : 'No server time';
  return `<p class="stamp">Phone ${esc(formatStamp(phone) || '—')}</p><p class="stamp">${esc(serverText)}</p>${file ? `<p class="stamp">File ${esc(file)}</p>` : ''}`;
}

function sideBlock(title: string, side: InspectionSide | undefined, shown: Map<string, string>, serverFallback?: string) {
  if (!side) return `<section><h2>${esc(title)}</h2><p>Not returned yet</p></section>`;
  const readings = [
    ['Fuel', side.fuel || 'Not recorded'],
    ['Miles', side.miles || '—'],
    ['Hours', side.hours || '—'],
  ];
  const spots = SPOTS.map((spot) => {
    const record = side.spots[spot.id] ?? { status: '', note: '', photos: [] };
    const photos = record.photos
      .map((photo, index) => {
        const src = shown.get(`${title}-${spot.id}-${index}`);
        if (!src) return '';
        const file = photo.sha256 ? photo.sha256.slice(0, 8) : '';
        return `<figure><img src="${src}" alt="${esc(spot.label)}">${clockLines(photo.addedAt, photo.serverAddedAt, serverFallback, file)}</figure>`;
      })
      .join('');
    const status = record.status === 'issue' ? 'Issue' : record.status === 'ok' ? 'OK' : '—';
    return `<article><h3>${esc(spot.label)}</h3>${photos || '<p>No photo</p>'}<p>${esc(record.note.trim() || 'No note')}</p><p><strong>${status}</strong></p></article>`;
  }).join('');
  const video = shown.get(`${title}-video`);
  return `<section>
    <h2>${esc(title)}</h2>
    <p>${esc(formatDay(side.date))}</p>
    <p>${esc(side.savedAt ? `Recorded on this phone ${formatStamp(side.savedAt)}` : '')}</p>
    <p>${esc(side.serverSavedAt ? `Server time ${formatStamp(side.serverSavedAt)}` : '')}</p>
    ${clocksDisagree(side.savedAt, side.serverSavedAt) ? '<p class="warn">Phone time does not match the server.</p>' : ''}
    <ul>${readings.map(([label, value]) => `<li>${esc(label)}: ${esc(value)}</li>`).join('')}</ul>
    ${video?.startsWith('data:') ? `<video controls playsinline src="${video}"></video>` : video ? `<p>The walk-around video is saved in the ${title === 'Check out' ? 'check-out' : 'check-in'} folder.</p>` : ''}
    ${video ? clockLines(side.videoAddedAt, side.videoServerAddedAt, serverFallback, side.videoSha256?.slice(0, 8)) : ''}
    ${side.notes ? `<p>Notes · ${esc(formatStamp(side.notesAt))}<br>${esc(side.notes)}</p>` : ''}
    ${spots}
  </section>`;
}

export async function buildRentalCard(rental: LocalRental) {
  if (typeof document === 'undefined') throw new Error('Saving a card to files works from the web app.');
  const vehicles = await loadCachedVehicles();
  const machine = vehicles.find((item) => item.id === rental.vehicleId);
  const machineName = machine?.nickname || machine?.yearMakeModel || 'Machine';
  const files: SavedFile[] = [];
  const shown = new Map<string, string>();
  const missing: string[] = [];
  const serverFallback = rental.serverReceivedAt ? new Date(rental.serverReceivedAt).toISOString() : undefined;

  const folderName = `${safeName(rental.renterName || 'Rental')} - ${safeName(formatDay(rental.checkout.date))}`;

  const addMedia = async (key: string, folder: string, filename: string, localUri?: string, remoteUrl?: string, fallback = 'jpg') => {
    const blob = await mediaBlob(localUri, remoteUrl);
    if (!blob) {
      if (localUri || remoteUrl) missing.push(filename);
      return;
    }
    const data = await asBytes(blob);
    const path = `${folderName}/${folder}/${filename}.${extFor(blob, fallback)}`;
    files.push({ name: path, data });
    const mime = blob.type || (fallback === 'mp4' ? 'video/mp4' : 'image/jpeg');
    const inline = !mime.startsWith('video') || data.length <= 30 * 1000 * 1000;
    shown.set(key, inline ? bytesToDataUrl(data, mime) : path);
  };

  for (const spot of SPOTS) {
    const checkout = rental.checkout.spots[spot.id];
    for (let index = 0; index < (checkout?.photos.length || 0); index += 1) {
      const photo = checkout.photos[index];
      await addMedia(`Check out-${spot.id}-${index}`, 'check-out', `${spot.id}-${index + 1}`, photo.localUri, photo.remoteUrl);
    }
    const checkin = rental.checkin?.spots[spot.id];
    if (checkin) {
      for (let index = 0; index < checkin.photos.length; index += 1) {
        const photo = checkin.photos[index];
        await addMedia(`Check in-${spot.id}-${index}`, 'check-in', `${spot.id}-${index + 1}`, photo.localUri, photo.remoteUrl);
      }
    }
  }
  await addMedia('Check out-video', 'check-out', 'walkaround', rental.checkout.videoUri, rental.checkout.videoUrl, 'mp4');
  if (rental.checkin) await addMedia('Check in-video', 'check-in', 'walkaround', rental.checkin.videoUri, rental.checkin.videoUrl, 'mp4');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(rental.renterName || 'Rental')} · ${esc(machineName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #e4d9c8; color: #1c1917; margin: 0; padding: 20px; }
    main { max-width: 980px; margin: 0 auto; }
    h1 { margin-bottom: 0; }
    h2 { margin-top: 28px; }
    article, section { background: #fffdf8; border-radius: 16px; padding: 14px; margin-top: 12px; }
    img { width: 100%; border-radius: 10px; }
    figure { margin: 8px 0; }
    figcaption, .muted, .stamp { color: #6f6a63; font-size: 13px; }
    video { width: 100%; border-radius: 10px; background: #1c1917; margin-top: 8px; }
    .warn { color: #b42318; font-weight: 700; }
    .note { font-weight: 700; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 700px) { .columns { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<main>
  <h1>${esc(rental.renterName || 'Renter')}</h1>
  <p>${esc(machineName)}${machine?.yearMakeModel ? ` · ${esc(machine.yearMakeModel)}` : ''}${machine?.vin ? ` · VIN ${esc(machine.vin)}` : ''}</p>
  <p class="muted">Out ${esc(formatDay(rental.checkout.date))}${rental.checkin ? ` · Back ${esc(formatDay(rental.checkin.date))}` : ''}</p>
  <p class="note">If the inspection was done offline, the server time is recorded when the next internet connection was made.</p>
  ${rental.serverReceivedAt ? `<p class="muted">Server received this record ${esc(formatStamp(new Date(rental.serverReceivedAt).toISOString()))}</p>` : ''}
  ${missing.length ? `<p class="warn">These files were not on this phone and could not be included: ${esc(missing.join(', '))}</p>` : ''}
  <div class="columns">
    ${sideBlock('Check out', rental.checkout, shown, rental.checkout.serverSavedAt || serverFallback)}
    ${sideBlock('Check in', rental.checkin, shown, rental.checkin?.serverSavedAt || serverFallback)}
  </div>
</main>
</body>
</html>`;
  files.unshift({ name: `${folderName}/Rental card.html`, data: new TextEncoder().encode(html) });

  const file = new File([zipStore(files)], `${folderName}.zip`, { type: 'application/zip' });
  return { file, missing };
}

export async function deliverRentalFile(file: File) {
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared' as const;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled' as const;
      if (error instanceof Error && error.name === 'NotAllowedError') return 'blocked' as const;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded' as const;
}
