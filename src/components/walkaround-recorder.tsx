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
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const open = async () => {
      try {
        const pending = primedCamera;
        primedCamera = null;
        let opened: WebSession;
        try {
          opened = await (pending ?? openWebCamera());
        } catch (error) {
          if (!pending) throw error;
          opened = await openWebCamera();
        }
        if (!live) {
          opened.stop();
          return;
        }
        session.current = opened;
        const video = videoRef.current;
        if (!video) throw new Error('camera');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = opened.preview;
        await video.play();
        if (live) {
          setError('');
          setReady(true);
        }
      } catch (error) {
        session.current?.stop();
        session.current = null;
        if (live) {
          setReady(false);
          setError(cameraStartMessage(error));
        }
      }
    };
    void open();
    return () => {
      live = false;
      session.current?.stop();
      session.current = null;
    };
  }, [attempt]);

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
    void session.current.start(() => {
      setRecording(false);
      setSaving(false);
      setError('The camera stopped while the signal was changing. This video was not saved. Record it again.');
    }).catch(() => {
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
    } catch (error) {
      setSaving(false);
      setError(error instanceof Error && error.message.startsWith('This video') ? error.message : 'This video could not be saved on the device. Try again.');
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
            <Text style={styles.savingNote}>A long video can take a minute. Keep this screen open.</Text>
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
              <Pressable
                style={[styles.record, !ready && !error && styles.dim]}
                onPress={error ? () => setAttempt((value) => value + 1) : start}
                disabled={!ready && !error}
              >
                <Text style={styles.recordText}>{error ? 'Try again' : 'Record'}</Text>
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
  start: (onInterrupted: (message: string) => void) => Promise<void>;
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
  const stream = await claimCamera();
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings() ?? {};
  const longSide = Math.max(settings.width || 0, settings.height || 0);
  const capped = longSide > 1920 ? capAt1080(stream) : directCapture(stream);
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stopping = false;
  let interrupted = false;
  let watch = 0;

  const stop = () => {
    window.clearInterval(watch);
    capped.stop();
    if (recorder && recorder.state === 'recording') recorder.stop();
    stream.getTracks().forEach((item) => item.stop());
  };

  return {
    preview: stream,
    start: async (onInterrupted) => {
      chunks = [];
      stopping = false;
      interrupted = false;
      window.clearInterval(watch);
      const output = await capped.ready;
      const mime = [
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp8',
        'video/webm',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const options: MediaRecorderOptions = { videoBitsPerSecond: 4_000_000 };
      if (mime) options.mimeType = mime;
      recorder = new MediaRecorder(output, options);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const cutOff = () => {
        if (stopping || interrupted) return;
        interrupted = true;
        stopping = true;
        window.clearInterval(watch);
        onInterrupted('The camera stopped while the signal was changing. This video was not saved. Record it again.');
        if (recorder && recorder.state === 'recording') recorder.stop();
      };
      recorder.onerror = () => cutOff();
      output.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (!stopping) cutOff();
        });
      });
      watch = window.setInterval(() => {
        if (capped.stalled()) cutOff();
      }, 1000);
      // One finished file when they press stop. A one-second slice leaves a file with no ending, which the iPhone plays as a live broadcast.
      recorder.start();
    },
    finish: () =>
      new Promise((resolve, reject) => {
        if (!recorder || recorder.state === 'inactive') {
          reject(new Error('not recording'));
          return;
        }
        stopping = true;
        window.clearInterval(watch);
        recorder.onstop = () => {
          const raw = new Blob(chunks, { type: recorder?.mimeType || 'video/mp4' });
          if (interrupted || !raw.size) {
            reject(new Error('This video was cut off before it finished saving. It was not kept. Record it again.'));
            return;
          }
          void import('../fix-video').then(({ flattenIfFragmented }) => flattenIfFragmented(raw)).then((blob) => recordedVideoPlays(blob).then((ok) => {
            if (!ok) {
              reject(new Error('This video was cut off before it finished saving. It was not kept. Record it again.'));
              return;
            }
            resolve(URL.createObjectURL(blob));
          })).catch(() => {
            reject(new Error('This video could not be saved on the device. Try again.'));
          });
        };
        recorder.stop();
      }),
    stop,
  };
}

function directCapture(source: MediaStream) {
  let lastLive = Date.now();
  const track = source.getVideoTracks()[0];
  const watch = window.setInterval(() => {
    if (track && track.readyState === 'live' && !track.muted) lastLive = Date.now();
  }, 500);
  return {
    ready: Promise.resolve(source),
    stalled: () => Date.now() - lastLive > 3000,
    stop: () => window.clearInterval(watch),
  };
}

function cameraStartMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'The camera could not start. Allow camera access and try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'The camera is in use by something else. Close other camera apps and tap Try again.';
  }
  return 'The camera could not start. Tap Try again.';
}

async function claimCamera() {
  const videos: MediaTrackConstraints[] = [
    { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    { facingMode: { ideal: 'environment' } },
    {},
  ];
  let last: unknown;
  for (const video of videos) {
    for (const audio of [true, false]) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio, video });
      } catch (error) {
        last = error;
        const name = error instanceof DOMException ? error.name : '';
        if ((name === 'NotAllowedError' || name === 'PermissionDeniedError') && !audio) throw error;
      }
    }
  }
  throw last instanceof Error ? last : new Error('camera');
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
  let seenFrame = false;
  let lastTime = -1;
  let lastMove = Date.now();
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
        if (video.currentTime !== lastTime) {
          seenFrame = true;
          lastTime = video.currentTime;
          lastMove = Date.now();
        }
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
    stalled: () => seenFrame && Date.now() - lastMove > 3000,
    stop: () => {
      drawing = false;
      captured?.getTracks().forEach((item) => item.stop());
    },
  };
}

function recordedVideoPlays(blob: Blob) {
  return new Promise<boolean>((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), 15000);
    const accept = () => {
      window.clearTimeout(timer);
      const visible = video.videoWidth > 0;
      const timed = Number.isFinite(video.duration) && video.duration >= 0.4;
      finish(visible && (timed || video.duration === Infinity));
    };
    video.onloadedmetadata = () => {
      if (video.videoWidth > 0 && Number.isFinite(video.duration) && video.duration >= 0.4) {
        accept();
        return;
      }
      video.addEventListener('timeupdate', () => accept(), { once: true });
      try {
        video.currentTime = 1e101;
      } catch {
        accept();
      }
      window.setTimeout(accept, 1500);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(false);
    };
    video.src = url;
  });
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
  error: { color: '#fff', textAlign: 'center', marginHorizontal: 20, marginBottom: 14, fontSize: 18, fontWeight: '700', lineHeight: 24 },
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
