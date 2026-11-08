import { useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SPOTS, emptySide, formatDay, keepPhoto, keepVideo, type InspectionSide, type SpotId } from '../fleet-store';
import { theme } from '../theme';

const FUEL = ['Not recorded', 'Empty', '1/4 tank', '1/2 tank', '3/4 tank', 'Full'];

type Props = {
  mode: 'checkout' | 'checkin';
  renterName: string;
  renterLocked?: boolean;
  onRenterName: (value: string) => void;
  side: InspectionSide;
  onChange: (side: InspectionSide) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
};

export function InspectionForm({ mode, renterName, renterLocked, onRenterName, side, onChange, onSave, saving, error }: Props) {
  const [fuelOpen, setFuelOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const isOut = mode === 'checkout';

  const patch = (partial: Partial<InspectionSide>) => onChange({ ...side, ...partial });

  const patchSpot = (spotId: SpotId, partial: Partial<InspectionSide['spots'][SpotId]>) => {
    onChange({ ...side, spots: { ...side.spots, [spotId]: { ...side.spots[spotId], ...partial } } });
  };

  const addPhotos = async (spotId: SpotId, camera: boolean) => {
    const room = 4 - side.spots[spotId].photos.length;
    if (room <= 0) return;
    const options = {
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.92,
      allowsMultipleSelection: !camera,
      selectionLimit: room,
    };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const saved = [];
    for (const asset of result.assets.slice(0, room)) {
      saved.push(await keepPhoto(asset.uri));
    }
    patchSpot(spotId, { photos: [...side.spots[spotId].photos, ...saved].slice(0, 4) });
  };

  const choosePhotos = (spotId: SpotId) => {
    if (side.spots[spotId].photos.length >= 4) return;
    if (Platform.OS === 'web') {
      void addPhotos(spotId, false);
      return;
    }
    Alert.alert('Add photos', 'Up to 4 photos for this spot.', [
      { text: 'Take Photo', onPress: () => void addPhotos(spotId, true) },
      { text: 'Photo Library', onPress: () => void addPhotos(spotId, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    patch({ videoUri: await keepVideo(result.assets[0].uri) });
  };

  return (
    <View>
      <Text style={styles.intro}>
        {isOut
          ? 'Walk around the machine and record its condition before it goes out. Saving keeps the inspection on this phone, then uploads when you have service.'
          : 'Record the machine as it comes back. Checkout photos stay beside these so you can compare them.'}
      </Text>

      <Text style={styles.label}>Renter name</Text>
      <TextInput
        style={styles.input}
        value={renterName}
        onChangeText={onRenterName}
        editable={!renterLocked}
        placeholder="Who's taking it out?"
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
          <Text style={styles.label}>Odometer miles (optional)</Text>
          <TextInput style={styles.input} value={side.miles} onChangeText={(miles) => patch({ miles })} keyboardType="numeric" placeholder="e.g. 1,240" placeholderTextColor={theme.muted} />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Engine hours (optional)</Text>
          <TextInput style={styles.input} value={side.hours} onChangeText={(hours) => patch({ hours })} keyboardType="decimal-pad" placeholder="e.g. 128.5" placeholderTextColor={theme.muted} />
        </View>
      </View>

      <Text style={styles.section}>Walk-around checklist</Text>
      <Text style={styles.help}>Each spot can hold up to 4 photos, so damage can be caught from more than one angle.</Text>

      {SPOTS.map((spot) => {
        const record = side.spots[spot.id];
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
                <View key={photo.id}>
                  <Image source={{ uri: photo.localUri }} style={styles.thumb} />
                  <Pressable onPress={() => patchSpot(spot.id, { photos: record.photos.filter((item) => item.id !== photo.id) })}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
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
      <Text style={styles.help}>Record a slow lap around the machine. It stays with this inspection and uploads after the card is saved.</Text>
      <Pressable style={styles.ghost} onPress={() => void addVideo()}>
        <Text style={styles.ghostText}>{side.videoUri ? 'Replace walk-around video' : 'Add walk-around video'}</Text>
      </Pressable>
      {side.videoUri ? <Text style={styles.count}>Video saved on this phone</Text> : null}

      <Text style={styles.label}>Overall notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={side.notes}
        onChangeText={(notes) => patch({ notes })}
        multiline
        placeholder="Anything else about this rental..."
        placeholderTextColor={theme.muted}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.save} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>
          {saving ? 'Saving...' : isOut ? 'Save & send out on rent' : 'Save & mark returned'}
        </Text>
      </Pressable>
    </View>
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
  thumb: { width: 92, height: 92, borderRadius: 10, backgroundColor: theme.input },
  ghost: { borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10, borderStyle: 'dashed' },
  ghostText: { color: theme.text, fontWeight: '600' },
  count: { color: theme.green, marginTop: 6, fontSize: 13 },
  remove: { color: theme.danger, fontSize: 13, marginTop: 4 },
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
});
