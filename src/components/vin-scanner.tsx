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

function paintFull(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.max(2, Math.round(sourceWidth * scale));
  canvas.height = Math.max(2, Math.round(sourceHeight * scale));
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = true;
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
}

function paintSpin(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const scale = Math.min(1.6, 1600 / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.max(2, Math.round(sourceHeight * scale));
  canvas.height = Math.max(2, Math.round(sourceWidth * scale));
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.height, canvas.width);
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

function punch(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const value = Math.max(0, Math.min(255, (gray - 128) * 1.4 + 128));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  return image;
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
      const found = (value: string) => {
        if (!extractVin(value)) return false;
        stop();
        onVinRef.current(value);
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
      let pass = 0;
      const readDense = async () => {
        if (!dense || !context) return false;
        try {
          const image = punch(canvas, context);
          const codes = await dense(image, {
            formats: ['PDF417', 'MicroPDF417', 'Code39', 'Code128', 'Code93'],
            tryHarder: true,
            tryRotate: true,
            tryInvert: true,
            tryDenoise: true,
            tryDownscale: false,
            maxNumberOfSymbols: 4,
          });
          return codes.some((code) => code.text && found(code.text));
        } catch {
          return false;
        }
      };
      const scan = async () => {
        if (!live) return;
        let shot: Shot | null = null;
        let bitmap: ImageBitmap | null = null;
        try {
          if (video.videoWidth && context) {
            const portrait = video.clientHeight >= video.clientWidth;
            if (android && imageCapture) {
              bitmap = await imageCapture.grabFrame().catch(() => null);
              if (!live) return;
              if (bitmap) shot = orientToScreen(bitmap, bitmap.width, bitmap.height, portrait);
            }
            if (!shot) shot = orientToScreen(video, video.videoWidth, video.videoHeight, portrait);
            if (zxing) {
              paintStrip(shot.source, shot.width, shot.height, canvas, context);
              if (blankFrame(canvas, context) && imageCapture && !bitmap) {
                const fallback = await imageCapture.grabFrame().catch(() => null);
                if (fallback) {
                  bitmap = fallback;
                  shot.close();
                  shot = orientToScreen(fallback, fallback.width, fallback.height, portrait);
                  paintStrip(shot.source, shot.width, shot.height, canvas, context);
                }
              }
              if (await read(zxing, canvas)) return;
              if (native && await read(native, canvas)) return;
              if (android) {
                const step = pass % 2;
                pass += 1;
                if (step === 0) paintFull(shot.source, shot.width, shot.height, canvas, context);
                else paintSpin(shot.source, shot.width, shot.height, canvas, context);
                if (await readDense()) return;
              } else {
                paintTurned(shot.source, shot.width, shot.height, canvas, context);
                if (await read(zxing, canvas)) return;
                if (native && await read(native, canvas)) return;
              }
            } else if (native) {
              if (await read(native, shot.source)) return;
            }
          }
        } catch {
          // A missed frame is not a failure. Keep the camera open.
        } finally {
          if (bitmap && shot?.source !== bitmap) bitmap.close();
          shot?.close();
        }
        timer = window.setTimeout(() => void scan(), android ? 80 : 200);
      };
      timer = window.setTimeout(() => void scan(), 400);
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
