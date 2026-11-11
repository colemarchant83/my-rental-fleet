import { createElement, useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ImageStyle } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { SPOTS, emptySide, formatDay, formatStamp, keepPhoto, keepVideo, type InspectionSide, type SpotId } from '../fleet-store';
import { ZoomModal } from './zoom-modal';
import { WalkaroundRecorder, primeWalkaroundCamera } from './walkaround-recorder';
import { contentTypeFor, deleteStoredFile, fingerprint, isStoredFile, mediaByteSize, readStoredBlob, useDisplayUri } from '../media';
import { beginUpload } from '../r2';
import { theme } from '../theme';

const FUEL = ['Not recorded', 'Empty', '1/4 tank', '1/2 tank', '3/4 tank', 'Full'];

type Props = {
  mode: 'checkout' | 'checkin';
  renterName: string;
  renterLocked?: boolean;
  onRenterName: (value: string) => void;
  side: InspectionSide;
  checkout?: InspectionSide;
  onChange: (side: InspectionSide) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
};

export function InspectionForm({ mode, renterName, renterLocked, onRenterName, side, checkout, onChange, onSave, saving, error }: Props) {
  const [fuelOpen, setFuelOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [librarySpot, setLibrarySpot] = useState<SpotId | null>(null);
  const [photoChoice, setPhotoChoice] = useState<SpotId | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
  const sideRef = useRef(side);
  sideRef.current = side;
  const isOut = mode === 'checkout';

  const publish = (next: InspectionSide) => {
    sideRef.current = next;
    onChange(next);
  };

  const patch = (partial: Partial<InspectionSide>) => publish({ ...sideRef.current, ...partial });

  const patchSpot = (spotId: SpotId, partial: Partial<InspectionSide['spots'][SpotId]>) => {
    const current = sideRef.current;
    publish({ ...current, spots: { ...current.spots, [spotId]: { ...current.spots[spotId], ...partial } } });
  };

  const addPhotos = async (spotId: SpotId, camera: boolean) => {
    const room = 4 - sideRef.current.spots[spotId].photos.length;
    if (room <= 0) return;
    const options = {
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.92,
      allowsMultipleSelection: !camera,
      selectionLimit: room,
    };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setPhotoError('');
    try {
      const saved = [];
      for (const asset of result.assets.slice(0, room)) {
        saved.push(await keepPhoto(asset.uri));
        if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      patchSpot(spotId, { photos: [...sideRef.current.spots[spotId].photos, ...saved].slice(0, 4) });
      for (const photo of saved) {
        void beginUpload(photo.localUri, `captures/${photo.id}.jpg`, contentTypeFor(photo.localUri))
          .then((remoteUrl) => {
            const spot = sideRef.current.spots[spotId];
            if (!spot?.photos.some((item) => item.id === photo.id)) return;
            patchSpot(spotId, { photos: spot.photos.map((item) => (item.id === photo.id ? { ...item, remoteUrl } : item)) });
          })
          .catch(() => undefined);
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'This photo could not be saved on the device. Try again.');
    }
  };

  const removePhoto = (spotId: SpotId, photoId: string) => {
    const photos = sideRef.current.spots[spotId].photos;
    const photo = photos.find((item) => item.id === photoId);
    if (photo?.localUri) void deleteStoredFile(photo.localUri);
    patchSpot(spotId, { photos: photos.filter((item) => item.id !== photoId) });
  };

  const choosePhotos = (spotId: SpotId) => {
    if (side.spots[spotId].photos.length >= 4) return;
    setPhotoChoice(spotId);
  };

  const addVideo = async (uri: string) => {
    setPhotoError('');
    const kept = await keepVideo(uri);
    patch({
      videoUri: kept.uri,
      videoAddedAt: kept.addedAt,
      videoServerAddedAt: kept.serverAddedAt,
      videoSha256: kept.sha256,
      videoUrl: undefined,
      videoOverLimit: false,
    });
    setVideoOpen(false);
    void fingerprint(kept.uri).then((sha256) => {
      if (!sha256 || sideRef.current.videoUri !== kept.uri) return;
      patch({ videoSha256: sha256 });
    });
    const bytes = await mediaByteSize(kept.uri);
    if (bytes > 100 * 1000 * 1000) {
      patch({ videoOverLimit: true });
      setPhotoError('This video is over 100 MB, so it will not be uploaded. Record a shorter one if you want it saved in storage. This copy stays on this phone.');
      return;
    }
    void beginUpload(kept.uri, `captures/video-${Date.now()}.mp4`, 'video/mp4')
      .then((videoUrl) => {
        if (sideRef.current.videoUri !== kept.uri) return;
        patch({ videoUrl });
      })
      .catch(() => undefined);
  };

  return (
    <View>
      <Text style={styles.intro}>
        {isOut
          ? 'Walk around the machine and record its condition before it goes out. Photos and video start sending while you finish the inspection. If you leave, sending continues the next time the app is opened.'
          : 'Record the machine as it comes back. Checkout photos stay beside these so you can compare them. Photos and video start sending while you finish. If you leave, sending continues the next time the app is opened.'}
      </Text>

      <Text style={styles.label}>Renter Name</Text>
      <TextInput
        style={styles.input}
        value={renterName}
        onChangeText={onRenterName}
        editable={!renterLocked}
        placeholder={renterLocked ? 'Renter name from checkout' : 'Renter Name'}
        placeholderTextColor={theme.muted}
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Date</Text>
          <Pressable style={styles.input} onPress={() => setDateOpen(true)}>
            <Text style={styles.inputText}>{formatDay(side.date)}</Text>
          </Pressable>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Fuel level</Text>
          <Pressable style={styles.input} onPress={() => setFuelOpen((open) => !open)}>
            <Text style={styles.inputText}>{side.fuel}</Text>
          </Pressable>
        </View>
      </View>
      {fuelOpen ? (
        <View style={styles.menu}>
          {FUEL.map((level) => (
            <Pressable key={level} style={styles.menuItem} onPress={() => { patch({ fuel: level }); setFuelOpen(false); }}>
              <Text style={styles.inputText}>{side.fuel === level ? '✓  ' : '    '}{level}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {dateOpen ? <DateSheet value={side.date} onPick={(date) => { patch({ date }); setDateOpen(false); }} onClose={() => setDateOpen(false)} /> : null}

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Odometer miles</Text>
          <TextInput style={styles.input} value={side.miles} onChangeText={(miles) => patch({ miles })} keyboardType="numeric" placeholder="e.g. 1,240" placeholderTextColor={theme.muted} />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Engine hours</Text>
          <TextInput style={styles.input} value={side.hours} onChangeText={(hours) => patch({ hours })} keyboardType="decimal-pad" placeholder="e.g. 128.5" placeholderTextColor={theme.muted} />
        </View>
      </View>
      <Text style={styles.help}>Enter miles or hours. One of them is required.</Text>

      <Text style={styles.section}>Walk-around checklist</Text>
      {checkout?.notes ? <Text style={styles.compareNote}>Checkout notes: {checkout.notes}</Text> : null}
      {!checkout ? <Text style={styles.help}>Each spot can hold up to 4 photos, so damage can be caught from more than one angle.</Text> : null}

      {SPOTS.map((spot) => {
        const record = side.spots[spot.id] ?? { status: '' as const, note: '', photos: [] };
        const earlier = checkout?.spots[spot.id];
        if (earlier) {
          const checkoutPhoto = spotPhoto(earlier.photos[0]);
          return (
            <View key={spot.id} style={styles.spot}>
              <Text style={styles.spotTitle}>{spot.label}</Text>
              <View style={styles.compare}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>From checkout</Text>
                  {checkoutPhoto ? <MediaImage uri={checkoutPhoto} style={styles.compareShot} onOpen={setZoom} /> : <View style={styles.compareFrame}><Text style={styles.blankText}>No checkout photo</Text></View>}
                  <ThumbRow photos={earlier.photos.slice(1)} onOpen={setZoom} />
                  {earlier.note ? <Text style={styles.compareNote}>{earlier.note}</Text> : null}
                  <Text style={styles.compareLabel}>{earlier.status === 'issue' ? 'Issue' : earlier.status === 'ok' ? 'OK' : '—'}</Text>
                </View>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>Return</Text>
                  {record.photos[0] ? (
                    <RemovablePhoto
                      uri={record.photos[0].localUri || record.photos[0].remoteUrl || ''}
                      style={styles.compareShot}
                      wide
                      onOpen={setZoom}
                      onRemove={() => removePhoto(spot.id, record.photos[0].id)}
                    />
                  ) : (
                    <Pressable style={[styles.compareFrame, styles.blank]} onPress={() => choosePhotos(spot.id)}>
                      <Text style={styles.blankText}>Tap to add return</Text>
                    </Pressable>
                  )}
                  <ThumbRow photos={record.photos.slice(1)} onOpen={setZoom} onRemove={(photoId) => removePhoto(spot.id, photoId)} />
                  {record.photos.length < 4 ? (
                    <Pressable style={styles.addPhoto} onPress={() => choosePhotos(spot.id)}>
                      <Text style={styles.addPhotoText}>Add photo</Text>
                    </Pressable>
                  ) : null}
                  {record.photos.length > 1 ? <Text style={styles.count}>{record.photos.length} photos</Text> : null}
                  <TextInput
                    style={styles.input}
                    value={record.note}
                    onChangeText={(note) => patchSpot(spot.id, { note })}
                    placeholder="Return note"
                    placeholderTextColor={theme.muted}
                  />
                  <View style={styles.choiceRow}>
                    <Pressable style={[styles.choice, record.status === 'ok' && styles.choiceOk]} onPress={() => patchSpot(spot.id, { status: 'ok' })}>
                      <Text style={[styles.choiceText, record.status === 'ok' && styles.choiceTextOn]}>✓ OK</Text>
                    </Pressable>
                    <Pressable style={[styles.choice, record.status === 'issue' && styles.choiceIssue]} onPress={() => patchSpot(spot.id, { status: 'issue' })}>
                      <Text style={styles.choiceText}>⚠ Issue</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        }
        return (
          <View key={spot.id} style={styles.spot}>
            <Text style={styles.spotTitle}>{spot.label}</Text>
            <View style={styles.choiceRow}>
              <Pressable style={[styles.choice, record.status === 'ok' && styles.choiceOk]} onPress={() => patchSpot(spot.id, { status: 'ok' })}>
                <Text style={[styles.choiceText, record.status === 'ok' && styles.choiceTextOn]}>✓  OK</Text>
              </Pressable>
              <Pressable style={[styles.choice, record.status === 'issue' && styles.choiceIssue]} onPress={() => patchSpot(spot.id, { status: 'issue' })}>
                <Text style={styles.choiceText}>⚠  Issue / damage</Text>
              </Pressable>
            </View>
            <View style={styles.photoRow}>
              {record.photos.map((photo) => (
                <RemovablePhoto
                  key={photo.id}
                  uri={photo.localUri}
                  style={styles.thumb}
                  onOpen={setZoom}
                  onRemove={() => removePhoto(spot.id, photo.id)}
                />
              ))}
            </View>
            <Pressable style={styles.ghost} onPress={() => choosePhotos(spot.id)}>
              <Text style={styles.ghostText}>{record.photos.length ? 'Add more photos' : 'Add photos'}</Text>
            </Pressable>
            {record.photos.length ? <Text style={styles.count}>{record.photos.length} of 4 photos for this spot</Text> : null}
            <TextInput
              style={styles.input}
              value={record.note}
              onChangeText={(note) => patchSpot(spot.id, { note })}
              placeholder="Note (scratches, wear, missing gear...)"
              placeholderTextColor={theme.muted}
            />
          </View>
        );
      })}

      <Text style={styles.section}>Walk-around video (optional)</Text>
      <Text style={styles.help}>Record a slow lap in the app. It is saved at 1080p, 30 fps. Videos already on the phone cannot be added.</Text>
      <Pressable style={styles.videoBtn} onPress={() => { primeWalkaroundCamera(); setVideoOpen(true); }}>
        <Text style={styles.videoBtnText}>{side.videoUri ? 'Replace Walk-around Video' : 'Record Walk-around Video'}</Text>
      </Pressable>
      {side.videoUri ? <VideoPreview uri={side.videoUri} /> : null}
      {side.videoUri && side.videoAddedAt ? <Text style={styles.count}>Recorded {formatStamp(side.videoAddedAt)}</Text> : null}

      <Text style={styles.label}>Overall notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={side.notes}
        onChangeText={(notes) => patch({ notes })}
        multiline
        placeholder="Anything else about this rental..."
        placeholderTextColor={theme.muted}
      />

      {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.help}>The save time is stamped automatically, along with each photo, video, and note.</Text>
      <Pressable style={styles.save} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>
          {saving ? 'Saving...' : isOut ? 'Save & send out on rent' : 'Save & mark returned'}
        </Text>
      </Pressable>
      <Modal visible={photoChoice !== null} transparent animationType="fade" onRequestClose={() => setPhotoChoice(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.spotTitle}>Add photos</Text>
            <Pressable
              style={styles.save}
              onPress={() => {
                const spotId = photoChoice;
                setPhotoChoice(null);
                if (spotId) void addPhotos(spotId, true);
              }}
            >
              <Text style={styles.saveText}>Take Photo</Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() => {
                const spotId = photoChoice;
                setPhotoChoice(null);
                if (spotId) setLibrarySpot(spotId);
              }}
            >
              <Text style={styles.ghostText}>Photo Library or Files</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => setPhotoChoice(null)}>
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ZoomModal uri={zoom} onClose={() => setZoom(null)} />
      <WalkaroundRecorder visible={videoOpen} onClose={() => setVideoOpen(false)} onRecorded={addVideo} />
      <Modal visible={librarySpot !== null} transparent animationType="fade" onRequestClose={() => setLibrarySpot(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.spotTitle}>Photo library</Text>
            <Text style={styles.help}>
              A photo from your library or files is stamped when you add it to this inspection, not when the camera first took it. Take Photo if you want the time the picture was made.
            </Text>
            <Pressable
              style={styles.save}
              onPress={() => {
                const spotId = librarySpot;
                setLibrarySpot(null);
                if (spotId) void addPhotos(spotId, false);
              }}
            >
              <Text style={styles.saveText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => setLibrarySpot(null)}>
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function VideoPreview({ uri }: { uri?: string }) {
  const [play, setPlay] = useState(false);
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!play) return;
    let live = true;
    let objectUrl = '';
    const load = async () => {
      if (!uri) {
        setSrc('');
        return;
      }
      if (uri.startsWith('http') || uri.startsWith('blob:') || uri.startsWith('data:')) {
        setSrc(uri);
        return;
      }
      if (uri.startsWith('idb:')) {
        const blob = await readStoredBlob(uri).catch(() => null);
        if (!live || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        return;
      }
      setSrc(uri);
    };
    void load();
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [play, uri]);
  if (!play || !src) {
    return (
      <Pressable style={styles.videoFrame} onPress={() => setPlay(true)}>
        <Text style={styles.playMark}>Play</Text>
      </Pressable>
    );
  }
  if (Platform.OS === 'web') {
    return (
      <View style={styles.videoFrame}>
        {createElement('video', {
          src,
          controls: true,
          playsInline: true,
          preload: 'none',
          style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#1c1917' },
        })}
      </View>
    );
  }
  return <Video source={{ uri: src }} style={styles.videoFrame} useNativeControls resizeMode={ResizeMode.COVER} />;
}

function spotPhoto(photo?: { localUri?: string; remoteUrl?: string }) {
  if (!photo) return '';
  if (photo.localUri && isStoredFile(photo.localUri)) return photo.localUri;
  return photo.remoteUrl || photo.localUri || '';
}

function ThumbRow({ photos, onOpen, onRemove }: { photos: { id: string; localUri?: string; remoteUrl?: string }[]; onOpen: (uri: string) => void; onRemove?: (photoId: string) => void }) {
  if (!photos.length) return null;
  return (
    <View style={styles.thumbRow}>
      {photos.map((photo) => onRemove ? (
        <RemovablePhoto key={photo.id} uri={photo.localUri || photo.remoteUrl || ''} style={styles.compareThumb} onOpen={onOpen} onRemove={() => onRemove(photo.id)} />
      ) : (
        <MediaImage key={photo.id} uri={photo.localUri || photo.remoteUrl || ''} style={styles.compareThumb} onOpen={onOpen} />
      ))}
    </View>
  );
}

function RemovablePhoto({ uri, style, wide, onOpen, onRemove }: { uri: string; style: StyleProp<ImageStyle>; wide?: boolean; onOpen: (uri: string) => void; onRemove: () => void }) {
  return (
    <View style={[styles.photoWrap, wide && styles.photoWrapWide]}>
      <MediaImage uri={uri} style={style} onOpen={onOpen} />
      <Pressable style={styles.photoX} onPress={onRemove} hitSlop={8}>
        <Text style={styles.photoXText}>×</Text>
      </Pressable>
    </View>
  );
}

function MediaImage({ uri, style, onOpen }: { uri: string; style: StyleProp<ImageStyle>; onOpen?: (uri: string) => void }) {
  const display = useDisplayUri(uri.startsWith('idb:') ? uri : undefined, uri.startsWith('http') ? uri : undefined);
  const [direct, setDirect] = useState('');
  useEffect(() => {
    if (uri.startsWith('idb:') || uri.startsWith('http')) {
      setDirect('');
      return;
    }
    let live = true;
    const load = async () => {
      if (!uri) {
        setDirect('');
        return;
      }
      if (uri.startsWith('blob:') || uri.startsWith('data:')) {
        setDirect(uri);
        return;
      }
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        if (live) setDirect(`data:${contentTypeFor(uri)};base64,${base64}`);
      } catch {
        if (live) setDirect('');
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [uri]);
  const shown = display.uri || direct;
  if (!shown) return <View style={style} />;
  const image = <Image source={{ uri: shown }} style={style} resizeMode="cover" />;
  if (!onOpen) return image;
  return (
    <Pressable
      style={styles.zoomTap}
      onPress={() => {
        if (!uri.startsWith('idb:')) {
          onOpen(shown);
          return;
        }
        void readStoredBlob(uri)
          .then((blob) => onOpen(blob ? URL.createObjectURL(blob) : shown))
          .catch(() => onOpen(shown));
      }}
    >
      {image}
      <Text style={styles.enlarge}>Enlarge</Text>
    </Pressable>
  );
}

function DateSheet({ value, onPick, onClose }: { value: string; onPick: (iso: string) => void; onClose: () => void }) {
  const [year, month] = value.split('-').map(Number);
  const [cursor, setCursor] = useState({ year: year || 2026, month: month || 1 });
  const count = new Date(cursor.year, cursor.month, 0).getDate();
  const pad = new Date(cursor.year, cursor.month - 1, 1).getDay();
  const cells = [...Array(pad).fill(0), ...Array.from({ length: count }, (_, index) => index + 1)];
  const label = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.calendar}>
      <View style={styles.calHead}>
        <Pressable onPress={() => setCursor((item) => item.month === 1 ? { year: item.year - 1, month: 12 } : { ...item, month: item.month - 1 })}><Text style={styles.calNav}>‹</Text></Pressable>
        <Text style={styles.spotTitle}>{label}</Text>
        <Pressable onPress={() => setCursor((item) => item.month === 12 ? { year: item.year + 1, month: 1 } : { ...item, month: item.month + 1 })}><Text style={styles.calNav}>›</Text></Pressable>
      </View>
      <View style={styles.days}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}${index}`} style={styles.dow}>{day}</Text>)}
        {cells.map((day, index) => {
          const iso = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <Pressable key={`${day}-${index}`} style={styles.day} onPress={() => day && onPick(iso)}>
              <Text style={[styles.dayText, iso === value && styles.dayOn]}>{day || ''}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onClose}><Text style={styles.remove}>Close</Text></Pressable>
    </View>
  );
}

export function freshInspection() {
  return emptySide();
}

const styles = StyleSheet.create({
  intro: { color: theme.muted, fontSize: 15, lineHeight: 21, marginBottom: 8 },
  label: { color: theme.text, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  section: { color: theme.text, fontSize: 20, fontWeight: '700', marginTop: 26 },
  help: { color: theme.muted, marginTop: 4, marginBottom: 8, lineHeight: 20 },
  input: { backgroundColor: theme.input, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: theme.text, fontSize: 16 },
  inputText: { color: theme.text, fontSize: 16 },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  menu: { backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.line, marginTop: 8 },
  menuItem: { padding: 12 },
  spot: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 14, marginTop: 12 },
  spotTitle: { color: theme.text, fontSize: 17, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  choice: { flex: 1, backgroundColor: theme.input, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  choiceOk: { backgroundColor: theme.green },
  choiceIssue: { backgroundColor: '#f3e2c4' },
  choiceText: { color: theme.text, fontWeight: '700' },
  choiceTextOn: { color: theme.white },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  photoWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoWrapWide: { alignSelf: 'stretch', width: '100%' },
  photoX: { position: 'absolute', top: 4, right: 4, zIndex: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,25,23,0.72)', alignItems: 'center', justifyContent: 'center' },
  photoXText: { color: '#fff', fontWeight: '800', fontSize: 18, lineHeight: 20 },
  thumb: { width: 92, height: 92, borderRadius: 10, backgroundColor: theme.input },
  compare: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },
  compareCol: { flex: 1, minWidth: 0 },
  compareLabel: { color: theme.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  compareShot: { width: '100%', height: 150, borderRadius: 12, backgroundColor: theme.input },
  thumbRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  compareThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: theme.input },
  addPhoto: { borderWidth: 1, borderColor: theme.action, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  addPhotoText: { color: theme.action, fontWeight: '800', fontSize: 14 },
  compareFrame: { width: '100%', minHeight: 150, borderRadius: 12, backgroundColor: theme.input, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blank: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.accent, backgroundColor: theme.card },
  blankText: { color: theme.accent, fontWeight: '700', textAlign: 'center', padding: 12 },
  compareNote: { color: theme.text, fontSize: 13, marginTop: 6, lineHeight: 18 },
  enlarge: { position: 'absolute', right: 6, bottom: 6, color: theme.white, backgroundColor: 'rgba(0,0,0,0.45)', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11 },
  zoomTap: { position: 'relative' },
  ghost: { borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10, borderStyle: 'dashed' },
  ghostText: { color: theme.text, fontWeight: '600' },
  count: { color: theme.green, marginTop: 6, fontSize: 13 },
  videoFrame: { marginTop: 10, height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1c1917', alignItems: 'center', justifyContent: 'center' },
  playMark: { color: '#fff', fontWeight: '800', fontSize: 18 },
  videoBtn: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  videoBtnText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  error: { color: theme.danger, marginTop: 14, fontWeight: '600' },
  save: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  saveText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  calendar: { backgroundColor: theme.card, borderRadius: 16, padding: 12, marginTop: 8, borderWidth: 1, borderColor: theme.line },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calNav: { fontSize: 24, color: theme.accent, paddingHorizontal: 8 },
  days: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  dow: { width: '14.28%', textAlign: 'center', color: theme.muted, fontSize: 12 },
  day: { width: '14.28%', paddingVertical: 8, alignItems: 'center' },
  dayText: { color: theme.text },
  dayOn: { backgroundColor: theme.accent, color: theme.white, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
});
