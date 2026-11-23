function fourcc(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

/** iPhone recordings are saved as a fragmented file. The picture stops while the sound continues unless it is rewritten as a normal video. */
export function looksFragmented(bytes: Uint8Array) {
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getUint32(0);
    const type = fourcc(bytes, offset + 4);
    if (type === 'moof' || type === 'styp') return true;
    if (type === 'ftyp') {
      const boxEnd = size >= 8 ? Math.min(bytes.length, offset + size) : Math.min(bytes.length, offset + 64);
      for (let brand = offset + 8; brand + 4 <= boxEnd; brand += 4) {
        if (brand === offset + 12) continue;
        const name = fourcc(bytes, brand);
        if (name === 'iso5' || name === 'iso6' || name === 'dash' || name === 'hlsf' || name === 'msdh' || name === 'msix') return true;
      }
    }
    if (size < 8 || size > bytes.length - offset) break;
    offset += size;
  }
  return false;
}

export async function remoteLooksFragmented(url: string) {
  const response = await fetch(url, { headers: { Range: 'bytes=0-8191' }, cache: 'no-store' });
  return looksFragmented(new Uint8Array(await response.arrayBuffer()));
}

export async function flattenIfFragmented(blob: Blob): Promise<Blob> {
  const head = new Uint8Array(await blob.slice(0, 8192).arrayBuffer());
  if (!looksFragmented(head)) return blob;
  try {
    const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    try {
      const conversion = await Conversion.init({ input, output });
      if (!conversion.isValid) return blob;
      await conversion.execute();
      if (!target.buffer?.byteLength) return blob;
      return new Blob([target.buffer], { type: 'video/mp4' });
    } finally {
      input.dispose();
    }
  } catch {
    return blob;
  }
}
