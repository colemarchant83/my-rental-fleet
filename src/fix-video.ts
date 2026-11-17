/** iPhone recordings are saved as a fragmented file. The picture stops while the sound continues unless it is rewritten as a normal video. */
export function looksFragmented(bytes: Uint8Array) {
  const sample = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  return sample.includes('moof') || sample.includes('hlsf') || sample.includes('iso5') || sample.includes('iso6');
}

export async function remoteLooksFragmented(url: string) {
  const response = await fetch(url, { headers: { Range: 'bytes=0-8191' }, cache: 'no-store' });
  return looksFragmented(new Uint8Array(await response.arrayBuffer()));
}

export async function flattenIfFragmented(blob: Blob): Promise<Blob> {
  const head = new Uint8Array(await blob.slice(0, 8192).arrayBuffer());
  if (!looksFragmented(head)) return blob;
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
  } catch {
    return blob;
  } finally {
    input.dispose();
  }
}
