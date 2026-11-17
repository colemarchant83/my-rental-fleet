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
  context.drawImage(source, x, y, cropW, cropH, 0, 0, canvas.width, canvas.height);
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
      await video.play();
      const native = await nativeDetector();
      let zxing: Detector | null = null;
      try {
        const { BarcodeDetector } = await import('barcode-detector/ponyfill');
        zxing = new BarcodeDetector({
          formats: ['code_39', 'code_128', 'code_93', 'qr_code', 'data_matrix', 'pdf417'],
        });
      } catch {
        zxing = null;
      }
      const ImageCaptureApi = (globalThis as { ImageCapture?: new (track: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }).ImageCapture;
      const capture = track && ImageCaptureApi ? new ImageCaptureApi(track) : null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      let pass = 0;
      const found = (value: string) => {
        if (!extractVin(value)) return false;
        stop();
        onVinRef.current(value);
        return true;
      };
      const scan = async () => {
        if (!live) return;
        try {
          if (pass % 2 === 0 && native && video.videoWidth) {
            const codes = await native.detect(video);
            if (codes.some((code) => code.rawValue && found(code.rawValue))) return;
          } else if (zxing && context) {
            let source: CanvasImageSource = video;
            let sourceWidth = video.videoWidth;
            let sourceHeight = video.videoHeight;
            if (capture) {
              const frame = await capture.grabFrame().catch(() => null);
              if (frame) {
                source = frame;
                sourceWidth = frame.width;
                sourceHeight = frame.height;
              }
            }
            if (sourceWidth && sourceHeight) {
              paintStrip(source, sourceWidth, sourceHeight, canvas, context);
              if (source instanceof ImageBitmap) source.close();
              const codes = await zxing.detect(canvas);
              if (codes.some((code) => code.rawValue && found(code.rawValue))) return;
            }
          }
        } catch {
          // A missed frame is not a failure. Keep the camera open.
        }
        pass += 1;
        timer = window.setTimeout(() => void scan(), 350);
      };
      timer = window.setTimeout(() => void scan(), 350);
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
      {error ? <Text style={{ position: 'absolute', left: 16, right: 16, bottom: 16, color: theme.white, fontWeight: '700' }}>{error}</Text> : null}
    </View>
  );
}
