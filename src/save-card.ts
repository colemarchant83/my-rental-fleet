import { Platform } from 'react-native';
import { Directory } from 'expo-file-system';
import { SPOTS, clocksDisagree, formatDay, formatStamp, loadCachedVehicles, type InspectionSide, type LocalRental } from './fleet-store';
import { readStoredBlob } from './media';

type SavedFile = { name: string; data: Uint8Array; modified?: Date };

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

function dosStamp(date: Date) {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function zipStore(items: SavedFile[]) {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const item of items) {
    const name = encoder.encode(item.name);
    const crc = crc32(item.data);
    const stamp = item.modified && !Number.isNaN(item.modified.getTime()) ? dosStamp(item.modified) : { time: 0, day: 0 };
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, stamp.time, true);
    view.setUint16(12, stamp.day, true);
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
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.day, true);
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

function fileName(value: string) {
  return value.replace(/[^\w.:-]+/g, ' ').trim().replace(/\s+/g, ' ') || 'file';
}

function clockName(phone?: string, server?: string, fallback?: string) {
  const phoneText = formatStamp(phone) || 'not recorded';
  const serverText = formatStamp(server || fallback) || 'not recorded';
  return fileName(`phone ${phoneText} server ${serverText}`);
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

async function previewUrl(blob: Blob) {
  if (blob.type.startsWith('video') || typeof createImageBitmap === 'undefined') return '';
  try {
    const bitmap = await createImageBitmap(blob);
    const max = 480;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return '';
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const preview = await new Promise<Blob | null>((resolve) => canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.62));
    canvas.width = 0;
    canvas.height = 0;
    if (!preview) return '';
    return bytesToDataUrl(new Uint8Array(await preview.arrayBuffer()), 'image/jpeg');
  } catch {
    return '';
  }
}

function clockLines(phone?: string, server?: string, fallback?: string, file?: string) {
  const serverText = server ? `Server ${formatStamp(server)}` : fallback ? `Server ${formatStamp(fallback)}` : 'No server time';
  return `<p class="stamp">Phone ${esc(formatStamp(phone) || '—')}</p><p class="stamp">${esc(serverText)}</p>${file ? `<p class="stamp">File ${esc(file)}</p>` : ''}`;
}

function sideBlock(title: string, side: InspectionSide | undefined, shown: Map<string, string>, serverFallback?: string, videoName?: string) {
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
    const heading = record.status === 'issue'
      ? `<h3>${esc(spot.label)}<span class="issue">Issue</span></h3>`
      : `<h3>${esc(spot.label)}</h3>`;
    const statusLine = record.status === 'issue' ? '' : `<p><strong>${status}</strong></p>`;
    return `<article>${heading}${photos || '<p>No photo</p>'}<p>${esc(record.note.trim() || 'No note')}</p>${statusLine}</article>`;
  }).join('');
  const video = shown.get(`${title}-video`);
  return `<section>
    <h2>${esc(title)}</h2>
    <p>${esc(formatDay(side.date))}</p>
    <p>${esc(side.savedAt ? `Recorded on this phone ${formatStamp(side.savedAt)}` : '')}</p>
    <p>${esc(side.serverSavedAt ? `Server time ${formatStamp(side.serverSavedAt)}` : '')}</p>
    ${clocksDisagree(side.savedAt, side.serverSavedAt) ? '<p class="warn">Phone time does not match the server.</p>' : ''}
    <ul>${readings.map(([label, value]) => `<li>${esc(label)}: ${esc(value)}</li>`).join('')}</ul>
    ${video?.startsWith('data:') ? `<video controls playsinline src="${video}"></video>` : videoName ? `<p>The walk-around video is the file named ${esc(videoName)}, next to this card.</p>` : ''}
    ${video ? clockLines(side.videoAddedAt, side.videoServerAddedAt, serverFallback, side.videoSha256?.slice(0, 8)) : ''}
    ${side.notes ? `<p>Notes · ${esc(formatStamp(side.notesAt))}<br>${esc(side.notes)}</p>` : ''}
    ${spots}
  </section>`;
}

export async function buildRentalCard(rental: LocalRental, knownMachine?: { nickname?: string; yearMakeModel?: string; vin?: string }) {
  if (typeof document === 'undefined') throw new Error('Saving a card to files works from the web app.');
  const vehicles = knownMachine ? [] : await loadCachedVehicles();
  const machine = knownMachine ?? vehicles.find((item) => item.id === rental.vehicleId);
  const machineName = machine?.nickname || machine?.yearMakeModel || 'Machine';
  const files: SavedFile[] = [];
  const shown = new Map<string, string>();
  const missing: string[] = [];
  const serverFallback = rental.serverReceivedAt ? new Date(rental.serverReceivedAt).toISOString() : undefined;

  const folderName = `${safeName(rental.renterName || 'Rental')} - ${safeName(formatDay(rental.checkout.date))}`;

  const addMedia = async (key: string, folder: string, filename: string, localUri?: string, remoteUrl?: string, fallback = 'jpg', modified?: string) => {
    const blob = await mediaBlob(localUri, remoteUrl);
    if (!blob) {
      if (localUri || remoteUrl) missing.push(filename);
      return '';
    }
    const data = await asBytes(blob);
    const fileName = `${filename}.${extFor(blob, fallback)}`;
    const path = folder ? `${folderName}/${folder}/${fileName}` : `${folderName}/${fileName}`;
    const when = modified ? new Date(modified) : undefined;
    files.push({ name: path, data, modified: when && !Number.isNaN(when.getTime()) ? when : undefined });
    const preview = await previewUrl(blob);
    shown.set(key, preview || encodeURI(folder ? `${folder}/${fileName}` : fileName));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return fileName;
  };

  for (const spot of SPOTS) {
    const checkout = rental.checkout.spots[spot.id];
    for (let index = 0; index < (checkout?.photos.length || 0); index += 1) {
      const photo = checkout.photos[index];
      await addMedia(
        `Check out-${spot.id}-${index}`,
        'check-out',
        `${spot.label} ${index + 1} ${clockName(photo.addedAt, photo.serverAddedAt, serverFallback)}`,
        photo.localUri,
        photo.remoteUrl,
        'jpg',
        photo.addedAt,
      );
    }
    const checkin = rental.checkin?.spots[spot.id];
    if (checkin) {
      for (let index = 0; index < checkin.photos.length; index += 1) {
        const photo = checkin.photos[index];
        await addMedia(
          `Check in-${spot.id}-${index}`,
          'check-in',
          `${spot.label} ${index + 1} ${clockName(photo.addedAt, photo.serverAddedAt, serverFallback)}`,
          photo.localUri,
          photo.remoteUrl,
          'jpg',
          photo.addedAt,
        );
      }
    }
  }
  const checkoutVideoName = await addMedia(
    'Check out-video',
    '',
    `Check out video ${clockName(rental.checkout.videoAddedAt, rental.checkout.videoServerAddedAt, serverFallback)}`,
    rental.checkout.videoUri,
    rental.checkout.videoUrl,
    'mp4',
    rental.checkout.videoAddedAt,
  );
  const checkinVideoName = rental.checkin
    ? await addMedia(
      'Check in-video',
      '',
      `Check in video ${clockName(rental.checkin.videoAddedAt, rental.checkin.videoServerAddedAt, serverFallback)}`,
      rental.checkin.videoUri,
      rental.checkin.videoUrl,
      'mp4',
      rental.checkin.videoAddedAt,
    )
    : '';

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
    h3 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .warn { color: #b42318; font-weight: 700; }
    .issue { color: #b42318; font-weight: 800; }
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
  <p class="note">The pictures on this page are smaller copies. The full photos and videos are in the check-out and check-in folders.</p>
  ${rental.serverReceivedAt ? `<p class="muted">Server received this record ${esc(formatStamp(new Date(rental.serverReceivedAt).toISOString()))}</p>` : ''}
  ${missing.length ? `<p class="warn">These files were not on this phone and could not be included: ${esc(missing.join(', '))}</p>` : ''}
  <div class="columns">
    ${sideBlock('Check out', rental.checkout, shown, rental.checkout.serverSavedAt || serverFallback, checkoutVideoName)}
    ${sideBlock('Check in', rental.checkin, shown, rental.checkin?.serverSavedAt || serverFallback, checkinVideoName)}
  </div>
</main>
</body>
</html>`;
  files.unshift({ name: `${folderName}/Rental card.html`, data: new TextEncoder().encode(html) });

  const file = new File([zipStore(files)], `${folderName}.zip`, { type: 'application/zip' });
  return { file, missing };
}

function wasCancelled(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code ?? '';
  return error.name === 'AbortError' || code === 'ERR_CANCELED' || /cancel/i.test(error.message);
}

/** Installed phone app only. Opens the Files folder so the card is saved there, with no Messages or Mail choice. */
async function saveWithPhoneFiles(file: File) {
  const directory = await Directory.pickDirectoryAsync();
  const stored = directory.createFile(file.name, 'application/zip');
  await stored.write(new Uint8Array(await file.arrayBuffer()));
  return 'saved' as const;
}

export async function deliverRentalFile(file: File) {
  if (Platform.OS !== 'web') {
    try {
      return await saveWithPhoneFiles(file);
    } catch (error) {
      if (wasCancelled(error)) return 'cancelled' as const;
      throw error;
    }
  }
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
