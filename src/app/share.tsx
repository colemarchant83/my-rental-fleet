import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { VideoPreview } from '../components/inspection-form';
import { SPOTS, formatDay, formatStamp, type InspectionSide, type LocalRental } from '../fleet-store';
import { buildRentalCard, deliverRentalFile } from '../save-card';
import { loadSharedCard, type SharedCard } from '../share-link';
import { theme } from '../theme';

function SidePhotos({ title, side }: { title: string; side?: InspectionSide }) {
  if (!side) return <Text style={styles.muted}>Not returned yet</Text>;
  return (
    <View>
      <Text style={styles.sideTitle}>{title}</Text>
      <Text style={styles.muted}>{formatDay(side.date)}</Text>
      {side.videoUrl ? <VideoPreview uri={side.videoUrl} /> : null}
      {SPOTS.map((spot) => {
        const record = side.spots[spot.id];
        const photos = record?.photos.filter((photo) => photo.remoteUrl) ?? [];
        if (!photos.length && !record?.note && !record?.status) return null;
        return (
          <View key={spot.id} style={styles.spot}>
            <Text style={styles.spotTitle}>
              {spot.label}
              {record?.status === 'issue' ? <Text style={styles.issue}>  Issue</Text> : null}
            </Text>
            {photos.map((photo) => (
              <View key={photo.id || photo.remoteUrl}>
                <Image source={{ uri: photo.remoteUrl }} style={styles.photo} resizeMode="cover" />
                {photo.addedAt ? <Text style={styles.muted}>Phone {formatStamp(photo.addedAt)}</Text> : null}
                {photo.serverAddedAt ? <Text style={styles.muted}>Server {formatStamp(photo.serverAddedAt)}</Text> : null}
              </View>
            ))}
            {record?.note?.trim() ? <Text style={styles.note}>{record.note}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export default function SharedRental() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const token = Array.isArray(params.id) ? params.id[0] : params.id;
  const [card, setCard] = useState<SharedCard | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState('');
  const built = useRef<File | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This link is missing the card.');
      return;
    }
    void loadSharedCard(token)
      .then(setCard)
      .catch(() => setError('This link could not be opened.'));
  }, [token]);

  const save = () => {
    if (!card) return;
    const openSave = (file: File) => {
      void deliverRentalFile(file).then((method) => {
        if (method === 'cancelled') return;
        if (method === 'blocked') {
          setReady(true);
          setNote('');
          return;
        }
        setReady(false);
        setNote('');
      });
    };
    if (built.current) {
      openSave(built.current);
      return;
    }
    const rental: LocalRental = {
      localId: 'share',
      vehicleId: 'share',
      renterName: card.renterName,
      checkout: card.checkout,
      checkin: card.checkin,
      status: card.status,
      sync: 'synced',
      createdAt: card.serverReceivedAt || Date.now(),
      serverReceivedAt: card.serverReceivedAt,
    };
    setSaving(true);
    setReady(false);
    setNote('');
    void buildRentalCard(rental, { nickname: card.machineName, yearMakeModel: card.yearMakeModel, vin: card.vin })
      .then(({ file }) => {
        built.current = file;
        openSave(file);
      })
      .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not save the files.'))
      .finally(() => setSaving(false));
  };

  if (error) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Rental card</Text>
        <Text style={styles.note}>{error}</Text>
      </View>
    );
  }
  if (!card) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Opening the rental card...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{card.renterName || 'Rental'}</Text>
      <Text style={styles.machine}>
        {card.machineName}
        {card.yearMakeModel && card.yearMakeModel !== card.machineName ? ` · ${card.yearMakeModel}` : ''}
        {card.vin ? ` · VIN ${card.vin}` : ''}
      </Text>
      <Text style={styles.muted}>
        Out {formatDay(card.checkout.date)}
        {card.checkin ? ` · Back ${formatDay(card.checkin.date)}` : ''}
      </Text>
      <Pressable style={styles.save} disabled={saving} onPress={save}>
        <Text style={styles.saveText}>{saving ? 'Preparing the files...' : ready ? 'Ready. Tap to save' : 'Save to files'}</Text>
      </Pressable>
      {note ? <Text style={styles.muted}>{note}</Text> : null}
      <Text style={styles.muted}>This saves the card, the photos, and the videos onto this phone or computer.</Text>
      <SidePhotos title="Check out" side={card.checkout} />
      <SidePhotos title="Check in" side={card.checkin} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingBottom: 48 },
  title: { color: theme.text, fontSize: 32, fontWeight: '800' },
  machine: { color: theme.text, fontSize: 16, marginTop: 8 },
  muted: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  save: { marginTop: 18, backgroundColor: theme.text, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: theme.white, fontWeight: '800' },
  sideTitle: { color: theme.text, fontSize: 22, fontWeight: '800', marginTop: 28 },
  spot: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginTop: 12 },
  spotTitle: { color: theme.text, fontSize: 17, fontWeight: '700' },
  issue: { color: theme.danger, fontWeight: '800' },
  photo: { width: '100%', height: 220, borderRadius: 12, marginTop: 10, backgroundColor: theme.input },
  note: { color: theme.text, marginTop: 8 },
});
