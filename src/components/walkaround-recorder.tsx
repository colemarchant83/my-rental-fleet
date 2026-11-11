import { createElement, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { theme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRecorded: (uri: string) => Promise<void>;
};

export function WalkaroundRecorder({ visible, onClose, onRecorded }: Props) {
  if (!visible) return null;
  return Platform.OS === 'web' ? <WebRecorder onClose={onClose} onRecorded={onRecorded} /> : <NativeRecorder onClose={onClose} onRecorded={onRecorded} />;
}

function WebRecorder({ onClose, onRecorded }: Omit<Props, 'visible'>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const session = useRef<WebSession | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    const open = async () => {
      try {
        const readyCamera = primedCamera ?? openWebCamera();
        primedCamera = null;
        session.current = await readyCamera;
        const video = videoRef.current;
        if (!video) throw new Error('camera');
        video.srcObject = session.current.preview;
        await video.play();
        if (live) setReady(true);
      } catch {
        if (live) setError('The camera could not start. Allow camera access and try again.');
      }
    };
    void open();
    return () => {
      live = false;
      session.current?.stop();
      session.current = null;
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const start = () => {
    if (!session.current || recording) return;
    setError('');
    setSeconds(0);
    setRecording(true);
    void session.current.start().catch(() => {
      setRecording(false);
      setError('Recording could not start. Try again.');
    });
  };

  const finish = async () => {
    if (!session.current || saving) return;
    setSaving(true);
    setRecording(false);
    let url = '';
    try {
      url = await session.current.finish();
      session.current.stop();
      await onRecorded(url);
    } catch {
      setSaving(false);
      setError('This video could not be saved on the device. Try again.');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.preview}>
          {createElement('video', {
            ref: videoRef,
            autoPlay: true,
            playsInline: true,
            muted: true,
            style: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
          })}
        </View>
        {saving ? (
          <View style={styles.saving}>
            <Text style={styles.savingTitle}>Saving the video</Text>
            <Text style={styles.savingNote}>A long video takes a few seconds. Keep this screen open.</Text>
          </View>
        ) : null}
        {!saving && recording ? <Text style={styles.timer}>{formatClock(seconds)}</Text> : null}
        {!saving && error ? <Text style={styles.error}>{error}</Text> : null}
        {saving ? null : (
          <View style={styles.controls}>
            {recording ? (
              <Pressable style={styles.stop} onPress={() => void finish()}>
                <Text style={styles.stopText}>Stop</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.record, !ready && styles.dim]} onPress={start} disabled={!ready}>
                <Text style={styles.recordText}>Record</Text>
              </Pressable>
            )}
            {!recording ? (
              <Pressable onPress={onClose}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

type WebSession = {
  preview: MediaStream;
  start: () => Promise<void>;
  finish: () => Promise<string>;
  stop: () => void;
};

let primedCamera: Promise<WebSession> | null = null;

export function primeWalkaroundCamera() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) return;
  if (!primedCamera) {
    primedCamera = openWebCamera().catch((error) => {
      primedCamera = null;
      throw error;
    });
  }
}

async function openWebCamera(): Promise<WebSession> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cameraConstraints() });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: cameraConstraints() });
  }
  const track = stream.getVideoTracks()[0];
  if (track) {
    await track.applyConstraints({
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1920, max: 1920 },
      frameRate: { ideal: 30, max: 30 },
    }).catch(() => undefined);
  }

  const capped = capAt1080(stream);
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  const stop = () => {
    capped.stop();
    if (recorder && recorder.state === 'recording') recorder.stop();
    stream.getTracks().forEach((item) => item.stop());
  };

  return {
    preview: stream,
    start: async () => {
      chunks = [];
      const output = await capped.ready;
      const mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      const options: MediaRecorderOptions = { videoBitsPerSecond: 4_000_000 };
      if (mime) options.mimeType = mime;
      recorder = new MediaRecorder(output, options);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.start(1000);
    },
    finish: () =>
      new Promise((resolve, reject) => {
        if (!recorder || recorder.state === 'inactive') {
          reject(new Error('not recording'));
          return;
        }
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/mp4' });
          if (!blob.size) {
            reject(new Error('empty'));
            return;
          }
          resolve(URL.createObjectURL(blob));
        };
        recorder.stop();
      }),
    stop,
  };
}

function cameraConstraints(): MediaTrackConstraints {
  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1920, max: 1920 },
    frameRate: { ideal: 30, max: 30 },
  };
}

function fittedSize(width: number, height: number) {
  const scale = Math.min(1, 1920 / Math.max(width, height));
  return {
    width: Math.max(2, Math.round((width * scale) / 2) * 2),
    height: Math.max(2, Math.round((height * scale) / 2) * 2),
  };
}

function capAt1080(source: MediaStream) {
  const video = document.createElement('video');
  video.srcObject = source;
  video.muted = true;
  video.playsInline = true;
  void video.play().catch(() => undefined);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let drawing = true;
  let captured: MediaStream | null = null;
  const ready = new Promise<MediaStream>((resolve) => {
    const wait = () => {
      if (!drawing) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        requestAnimationFrame(wait);
        return;
      }
      const size = fittedSize(width, height);
      canvas.width = size.width;
      canvas.height = size.height;
      captured = typeof canvas.captureStream === 'function' ? canvas.captureStream(30) : null;
      if (!captured) {
        drawing = false;
        resolve(source);
        return;
      }
      const audio = source.getAudioTracks()[0];
      if (audio) captured.addTrack(audio);
      const draw = () => {
        if (!drawing || !context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };
      draw();
      resolve(captured);
    };
    requestAnimationFrame(wait);
  });
  return {
    ready,
    stop: () => {
      drawing = false;
      captured?.getTracks().forEach((item) => item.stop());
    },
  };
}

function NativeRecorder({ onClose, onRecorded }: Omit<Props, 'visible'>) {
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) void requestCamera();
    if (micPermission && !micPermission.granted) void requestMic();
  }, [cameraPermission, micPermission, requestCamera, requestMic]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const start = () => {
    if (!camera.current || recording) return;
    setError('');
    setSeconds(0);
    setRecording(true);
    void camera.current
      .recordAsync(Platform.OS === 'ios' ? { codec: 'avc1' } : {})
      .then(async (result) => {
        if (!result?.uri) throw new Error('empty');
        setSaving(true);
        await onRecorded(result.uri);
      })
      .catch(() => {
        setRecording(false);
        setSaving(false);
        setError('This video could not be saved on the device. Try again.');
      });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <CameraView ref={camera} style={styles.preview} facing="back" mode="video" videoQuality="1080p" videoBitrate={4_000_000} />
        {recording ? <Text style={styles.timer}>{formatClock(seconds)}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.controls}>
          {recording ? (
            <Pressable style={styles.stop} onPress={() => camera.current?.stopRecording()} disabled={saving}>
              <Text style={styles.stopText}>{saving ? 'Saving...' : 'Stop'}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.record} onPress={start}>
              <Text style={styles.recordText}>Record</Text>
            </Pressable>
          )}
          {!recording ? (
            <Pressable onPress={onClose}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' },
  preview: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  note: { color: '#fff', textAlign: 'center', marginBottom: 8, fontWeight: '700' },
  timer: { color: '#fff', textAlign: 'center', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  error: { color: '#fecaca', textAlign: 'center', marginHorizontal: 24, marginBottom: 8 },
  controls: { alignItems: 'center', paddingBottom: 36, gap: 16 },
  record: { backgroundColor: theme.danger, borderRadius: 28, paddingVertical: 16, paddingHorizontal: 36 },
  recordText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  dim: { opacity: 0.4 },
  saving: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#000',
  },
  savingTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  savingNote: { color: '#e7e1d6', fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  stop: { backgroundColor: theme.action, borderRadius: 28, paddingVertical: 16, paddingHorizontal: 36 },
  stopText: { color: theme.ink, fontWeight: '800', fontSize: 18 },
  cancel: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
