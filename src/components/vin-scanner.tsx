import { createElement, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  onVin: (value: string) => void;
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const LETTERS: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

function checkDigit(vin: string) {
  let sum = 0;
  for (let index = 0; index < 17; index += 1) {
    const char = vin[index];
    const value = char >= '0' && char <= '9' ? Number(char) : LETTERS[char];
    if (value === undefined) return false;
    sum += value * WEIGHTS[index];
  }
  const mod = sum % 11;
  return vin[8] === (mod === 10 ? 'X' : String(mod));
}

export function extractVin(text: string) {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const candidates: string[] = [];
  for (let index = 0; index <= compact.length - 17; index += 1) {
    const slice = compact.slice(index, index + 17).replace(/[IOQ]/g, (char) => (char === 'I' ? '1' : '0'));
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(slice)) candidates.push(slice);
  }
  return candidates.find(checkDigit) || (compact.length <= 20 ? candidates[candidates.length - 1] : '') || '';
}

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]> };
type DenseReader = (image: ImageData, options: Record<string, unknown>) => Promise<{ text?: string }[]>;
type Shot = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function nativeDetector(): Promise<Detector | null> {
  const Native = (globalThis as { BarcodeDetector?: { new (options: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!Native) return null;
  const wanted = ['code_39', 'code_128', 'code_93', 'qr_code', 'data_matrix', 'pdf417', 'aztec', 'codabar', 'itf'];
  try {
    const supported = Native.getSupportedFormats ? await Native.getSupportedFormats() : wanted;
    const formats = wanted.filter((format) => supported.includes(format));
    if (!formats.length) return null;
    return new Native({ formats });
  } catch {
    return null;
  }
}

function paintStrip(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const cropW = Math.round(sourceWidth * 0.78);
  const cropH = Math.max(64, Math.round(sourceHeight * 0.24));
  const x = Math.round((sourceWidth - cropW) / 2);
  const y = Math.round((sourceHeight - cropH) / 2);
  const scale = Math.min(1, 1400 / cropW);
  canvas.width = Math.max(2, Math.round(cropW * scale));
  canvas.height = Math.max(2, Math.round(cropH * scale));
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(source, x, y, cropW, cropH, 0, 0, canvas.width, canvas.height);
}

function paintTurned(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, wide = false) {
  const cropW = Math.max(64, Math.round(sourceWidth * (wide ? 0.56 : 0.32)));
  const cropH = Math.round(sourceHeight * (wide ? 0.86 : 0.78));
  const x = Math.round((sourceWidth - cropW) / 2);
  const y = Math.round((sourceHeight - cropH) / 2);
  const scale = wide ? Math.max(1, Math.min(2.2, 1280 / cropH)) : Math.min(1, 1400 / cropH);
  canvas.width = Math.max(2, Math.round(cropH * scale));
  canvas.height = Math.max(2, Math.round(cropW * scale));
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = !wide;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(source, x, y, cropW, cropH, 0, 0, canvas.height, canvas.width);
  context.setTransform(1, 0, 0, 1, 0, 0);
}

function orientToScreen(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, portrait: boolean): Shot {
  const sourcePortrait = sourceHeight >= sourceWidth;
  if (sourcePortrait === portrait) return { source, width: sourceWidth, height: sourceHeight, close: () => undefined };
  const turned = document.createElement('canvas');
  turned.width = sourceHeight;
  turned.height = sourceWidth;
  const turnedContext = turned.getContext('2d');
  if (!turnedContext) return { source, width: sourceWidth, height: sourceHeight, close: () => undefined };
  turnedContext.translate(turned.width, 0);
  turnedContext.rotate(Math.PI / 2);
  turnedContext.drawImage(source, 0, 0);
  return { source: turned, width: turned.width, height: turned.height, close: () => undefined };
}

function glare(image: ImageData) {
  const copy = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const data = copy.data;
  const hist = new Uint32Array(256);
  let samples = 0;
  for (let index = 0; index < data.length; index += 16) {
    const gray = Math.min(data[index], data[index + 1], data[index + 2]);
    hist[gray] += 1;
    samples += 1;
  }
  const cut = Math.max(1, Math.floor(samples * 0.05));
  let low = 0;
  let high = 255;
  let seen = 0;
  for (let index = 0; index < 256; index += 1) {
    seen += hist[index];
    if (seen >= cut) { low = index; break; }
  }
  seen = 0;
  for (let index = 255; index >= 0; index -= 1) {
    seen += hist[index];
    if (seen >= cut) { high = index; break; }
  }
  const span = Math.max(24, high - low);
  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.min(data[index], data[index + 1], data[index + 2]);
    const value = Math.max(0, Math.min(255, ((gray - low) * 255) / span));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  return copy;
}

function paintAimed(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  clockwise: boolean,
  full: boolean,
) {
  const safeW = Math.max(1, viewWidth);
  const safeH = Math.max(1, viewHeight);
  const cover = Math.max(safeW / sourceWidth, safeH / sourceHeight);
  const cropW = full ? sourceWidth : Math.min(sourceWidth, safeW / cover);
  const cropH = full ? sourceHeight : Math.min(sourceHeight, safeH / cover);
  const x = full ? 0 : Math.max(0, (sourceWidth - cropW) / 2);
  const y = full ? 0 : Math.max(0, (sourceHeight - cropH) / 2);
  const longSide = Math.max(cropW, cropH);
  const out = longSide > 2000 ? 2000 / longSide : 1;
  const destW = Math.max(2, Math.round(cropW * out));
  const destH = Math.max(2, Math.round(cropH * out));
  if (clockwise) {
    canvas.width = destH;
    canvas.height = destW;
  } else {
    canvas.width = destW;
    canvas.height = destH;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = out < 0.999;
  if (clockwise) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  }
  context.drawImage(source, x, y, cropW, cropH, 0, 0, destW, destH);
  context.setTransform(1, 0, 0, 1, 0, 0);
}

function blankFrame(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  try {
    const side = Math.min(8, canvas.width, canvas.height);
    if (side < 2) return true;
    const data = context.getImageData(Math.floor((canvas.width - side) / 2), Math.floor((canvas.height - side) / 2), side, side).data;
    let total = 0;
    for (let index = 0; index < data.length; index += 4) total += data[index] + data[index + 1] + data[index + 2];
    return total / (data.length / 4) < 14;
  } catch {
    return false;
  }
}

export function WebVinScanner({ onVin }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onVinRef = useRef(onVin);
  const [error, setError] = useState('');
  onVinRef.current = onVin;

  useEffect(() => {
    let live = true;
    let stream: MediaStream | null = null;
    let timer = 0;
    const stop = () => {
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };
    const open = async () => {
      const attempts: MediaStreamConstraints[] = [
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        { audio: false, video: true },
      ];
      let last: unknown;
      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          last = err;
        }
      }
      const video = videoRef.current;
      if (!live || !stream || !video) {
        if (live) setError(last instanceof DOMException && last.name === 'NotAllowedError'
          ? 'The camera could not start. Allow camera access and try again.'
          : 'The camera could not start. Close other camera apps and try again.');
        stop();
        return;
      }
      const track = stream.getVideoTracks()[0];
      if (track) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      await video.play();
      if (!live) { stop(); return; }
      const native = await nativeDetector();
      let zxing: Detector | null = null;
      try {
        const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill');
        setZXingModuleOverrides({
          locateFile: (path: string, prefix: string) => (String(path).includes('zxing_reader') ? '/zxing_reader.wasm' : prefix + path),
        });
        zxing = new BarcodeDetector({
          formats: ['code_39', 'code_128', 'code_93', 'qr_code', 'data_matrix', 'pdf417'],
        });
      } catch {
        zxing = null;
      }
      const Capture = (globalThis as { ImageCapture?: new (track: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }).ImageCapture;
      const imageCapture = Capture && track ? new Capture(track) : null;
      const android = /Android/i.test(navigator.userAgent);
      let dense: DenseReader | null = null;
      if (android) {
        try {
          const reader = await import('zxing-wasm/reader');
          reader.setZXingModuleOverrides({
            locateFile: (path: string, prefix: string) => (String(path).includes('zxing_reader') ? '/zxing_reader.wasm' : prefix + path),
          });
          dense = reader.readBarcodes as DenseReader;
        } catch {
          dense = null;
        }
      }
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const align = document.createElement('canvas');
      const alignContext = align.getContext('2d', { willReadFrequently: true });
      const found = (value: string) => {
        const vin = extractVin(value);
        if (!vin) return false;
        stop();
        onVinRef.current(vin);
        return true;
      };
      const read = async (detector: Detector, source: CanvasImageSource) => {
        try {
          const codes = await detector.detect(source);
          return Boolean(codes?.some((code) => code.rawValue && found(code.rawValue)));
        } catch {
          return false;
        }
      };
      if (zxing && context) {
        canvas.width = 4;
        canvas.height = 4;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 4, 4);
        const ready = await zxing.detect(canvas).then(() => true).catch(() => false);
        if (!ready) zxing = null;
      }
      const sharpOptions: Record<string, unknown> = {
        formats: ['Code39', 'Code128', 'Code93'],
        tryHarder: true,
        tryRotate: false,
        tryInvert: true,
        tryDenoise: false,
        tryDownscale: false,
        minLineCount: 1,
        maxNumberOfSymbols: 2,
        textMode: 'Plain',
      };
      const readSharp = async () => {
        if (!dense || !context || canvas.width < 2 || canvas.height < 2) return false;
        let raw: ImageData;
        try {
          raw = context.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          return false;
        }
        try {
          const first = await dense(raw, sharpOptions);
          if (first.some((code) => code.text && found(code.text))) return true;
        } catch {
          // Try the glare pass anyway.
        }
        try {
          const second = await dense(glare(raw), sharpOptions);
          return second.some((code) => code.text && found(code.text));
        } catch {
          return false;
        }
      };
      const takeFrame = async (): Promise<Shot | null> => {
        if (imageCapture) {
          let ignoreLate = false;
          let grabTimer = 0;
          const grabbed = await Promise.race([
            imageCapture.grabFrame().then((frame) => {
              if (ignoreLate || !live) { frame.close(); return null; }
              return frame;
            }).catch(() => null),
            new Promise<ImageBitmap | null>((resolve) => { grabTimer = window.setTimeout(() => { ignoreLate = true; resolve(null); }, 220); }),
          ]);
          window.clearTimeout(grabTimer);
          if (grabbed && grabbed.width > 8 && grabbed.height > 8) {
            const frame = grabbed;
            return { source: frame, width: frame.width, height: frame.height, close: () => frame.close() };
          }
        }
        if (!video.videoWidth) return null;
        return { source: video, width: video.videoWidth, height: video.videoHeight, close: () => undefined };
      };
      let pass = 0;
      const scan = async () => {
        if (!live) return;
        let shot: Shot | null = null;
        try {
          if (video.videoWidth && context && android && dense && alignContext) {
            shot = await takeFrame();
            if (!live) return;
            if (shot) {
              let source = shot.source;
              let sourceWidth = shot.width;
              let sourceHeight = shot.height;
              const videoLandscape = video.videoWidth >= video.videoHeight;
              const shotLandscape = sourceWidth >= sourceHeight;
              if (videoLandscape !== shotLandscape) {
                align.width = sourceHeight;
                align.height = sourceWidth;
                alignContext.setTransform(1, 0, 0, 1, 0, 0);
                alignContext.imageSmoothingEnabled = false;
                alignContext.translate(align.width, 0);
                alignContext.rotate(Math.PI / 2);
                alignContext.drawImage(source, 0, 0);
                alignContext.setTransform(1, 0, 0, 1, 0, 0);
                source = align;
                sourceWidth = align.width;
                sourceHeight = align.height;
              }
              // Door barcodes are vertical, same as on the iPhone. Turn the picture
              // for the reader only. Leave the camera preview as the truck looks.
              const vertical = pass % 4 !== 3;
              const full = pass % 3 === 2;
              pass += 1;
              const viewWidth = video.clientWidth || sourceWidth;
              const viewHeight = video.clientHeight || sourceHeight;
              paintAimed(source, sourceWidth, sourceHeight, viewWidth, viewHeight, canvas, context, vertical, full);
              if (blankFrame(canvas, context) && source !== video) {
                paintAimed(video, video.videoWidth, video.videoHeight, viewWidth, viewHeight, canvas, context, vertical, full);
              }
              if (await readSharp()) return;
            }
          } else if (video.videoWidth && context) {
            const portrait = video.clientHeight >= video.clientWidth;
            shot = orientToScreen(video, video.videoWidth, video.videoHeight, portrait);
            if (zxing) {
              paintStrip(shot.source, shot.width, shot.height, canvas, context);
              if (await read(zxing, canvas)) return;
              if (native && await read(native, canvas)) return;
              paintTurned(shot.source, shot.width, shot.height, canvas, context);
              if (await read(zxing, canvas)) return;
              if (native && await read(native, canvas)) return;
            } else if (native && await read(native, shot.source)) return;
          }
        } catch {
          // A missed frame is not a failure. Keep the camera open.
        } finally {
          shot?.close();
        }
        if (!live) return;
        timer = window.setTimeout(() => void scan(), android ? 30 : 200);
      };
      timer = window.setTimeout(() => void scan(), 300);
    };
    void open().catch(() => {
      if (live) setError('The camera could not start. Allow camera access and try again.');
    });
    return () => {
      live = false;
      stop();
    };
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#111' }}>
      {createElement('video', {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#111' },
      })}
      <View pointerEvents="none" style={{ position: 'absolute', left: '8%', right: '8%', top: '38%', height: 84, borderWidth: 3, borderColor: theme.white, borderRadius: 12 }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: '36%', width: '28%', top: '12%', bottom: '12%', borderWidth: 3, borderColor: theme.white, borderRadius: 12 }} />
      {error ? <Text style={{ position: 'absolute', left: 16, right: 16, bottom: 16, color: theme.white, fontWeight: '700' }}>{error}</Text> : null}
    </View>
  );
}
