import { createElement, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  onVin: (value: string) => void;
};

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
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      const { BarcodeDetector } = await import('barcode-detector/ponyfill');
      const detector = new BarcodeDetector({
        formats: ['code_39', 'code_128', 'code_93', 'qr_code', 'data_matrix', 'pdf417'],
      });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const scan = async () => {
        if (!live) return;
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (context && width && height) {
          const scale = Math.min(1, 960 / width);
          canvas.width = Math.max(2, Math.round(width * scale));
          canvas.height = Math.max(2, Math.round(height * scale));
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const codes = await detector.detect(canvas);
            const value = codes.map((code) => code.rawValue).find((item) => item);
            if (value) {
              stop();
              onVinRef.current(value);
              return;
            }
          } catch {
            // Keep looking. A single missed frame is not a failure.
          }
        }
        timer = window.setTimeout(() => void scan(), 400);
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
      {error ? <Text style={{ position: 'absolute', left: 16, right: 16, bottom: 16, color: theme.white, fontWeight: '700' }}>{error}</Text> : null}
    </View>
  );
}
