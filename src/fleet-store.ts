import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { addDoc, collection, deleteDoc, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { contentTypeFor, deleteStoredFile, isStoredFile, persistMedia, remoteMediaLoads } from './media';
import { uploadFile, deleteStoredObject } from './r2';

export const SPOTS = [
  { id: 'tires', label: 'Tires & wheels' },
  { id: 'front', label: 'Body — front' },
  { id: 'left', label: 'Body — left side' },
  { id: 'right', label: 'Body — right side' },
  { id: 'rear', label: 'Body — rear' },
  { id: 'windshield', label: 'Windshield' },
  { id: 'accessories', label: 'Accessories & gear' },
] as const;

export type SpotId = (typeof SPOTS)[number]['id'];

export type PhotoRef = {
  id: string;
  localUri: string;
  remoteUrl?: string;
  addedAt?: string;
};

export type SpotRecord = {
  status: 'ok' | 'issue' | '';
  note: string;
  notedAt?: string;
  photos: PhotoRef[];
};

export type InspectionSide = {
  date: string;
  fuel: string;
  miles: string;
  hours: string;
  notes: string;
  notesAt?: string;
  savedAt?: string;
  videoUri?: string;
  videoUrl?: string;
  videoAddedAt?: string;
  spots: Record<SpotId, SpotRecord>;
};

export type LocalRental = {
  localId: string;
  remoteId?: string;
  vehicleId: string;
  renterName: string;
  checkout: InspectionSide;
  checkin?: InspectionSide;
  status: 'out' | 'closed';
  sync: 'pending' | 'synced' | 'error';
  syncError?: string;
  createdAt: number;
};

export type CoverPhoto = {
  vehicleId: string;
  localUri: string;
  remoteUrl?: string;
  addedAt?: string;
  sync: 'pending' | 'synced' | 'error';
};

const RENTALS_KEY = 'fleet.rentals.v1';
const COVERS_KEY = 'fleet.covers.v1';

const listeners = new Set<() => void>();

export function subscribeFleet(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatStamp(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function stampNow() {
  return new Date().toISOString();
}

/** Stamp the inspection at the moment it is saved. Photo times are already set when each photo was added. */
export function stampSide(side: InspectionSide): InspectionSide {
  const savedAt = stampNow();
  const spots = {} as Record<SpotId, SpotRecord>;
  for (const spot of SPOTS) {
    const current = side.spots[spot.id];
    spots[spot.id] = { ...current, notedAt: current.note.trim() ? savedAt : undefined };
  }
  return { ...side, savedAt, notesAt: side.notes.trim() ? savedAt : undefined, spots };
}

export function formatDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function emptySide(date = todayIso()): InspectionSide {
  const spots = {} as Record<SpotId, SpotRecord>;
  for (const spot of SPOTS) {
    spots[spot.id] = { status: 'ok', note: '', photos: [] };
  }
  return { date, fuel: 'Not recorded', miles: '', hours: '', notes: '', spots };
}

export function isOutStatus(status?: string) {
  return status === 'Out on rent' || status === 'On Rent';
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  emit();
}

export async function loadRentals() {
  return readJson<LocalRental[]>(RENTALS_KEY, []);
}

export async function loadCovers() {
  return readJson<CoverPhoto[]>(COVERS_KEY, []);
}

async function saveRentals(rentals: LocalRental[]) {
  await writeJson(RENTALS_KEY, rentals);
}

async function saveCovers(covers: CoverPhoto[]) {
  await writeJson(COVERS_KEY, covers);
}

export async function openRentalFor(vehicleId: string) {
  const rentals = await loadRentals();
  return rentals
    .filter((rental) => rental.vehicleId === vehicleId && rental.status === 'out')
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function rentalByLocalId(localId: string) {
  const rentals = await loadRentals();
  return rentals.find((rental) => rental.localId === localId);
}

async function discardSideFiles(side?: InspectionSide) {
  if (!side) return;
  for (const spot of SPOTS) {
    for (const photo of side.spots[spot.id].photos) {
      await deleteStoredFile(photo.localUri);
      await deleteStoredObject(photo.remoteUrl);
    }
  }
  await deleteStoredFile(side.videoUri);
  await deleteStoredObject(side.videoUrl);
}

export async function deleteRental(target: LocalRental) {
  const rentals = await loadRentals();
  await discardSideFiles(target.checkout);
  await discardSideFiles(target.checkin);
  if (target.remoteId) {
    await deleteDoc(doc(db, 'rentals', target.remoteId)).catch(() => undefined);
  }
  const remaining = rentals.filter((rental) => rental.localId !== target.localId);
  await saveRentals(remaining);
  const stillOut = remaining.some((rental) => rental.vehicleId === target.vehicleId && rental.status === 'out');
  if (target.status === 'out' && !stillOut) {
    await updateDoc(doc(db, 'vehicles', target.vehicleId), {
      status: 'Available',
      renterName: deleteField(),
    }).catch(() => undefined);
  }
}

export async function saveCheckout(vehicleId: string, renterName: string, checkout: InspectionSide) {
  const rental: LocalRental = {
    localId: id(),
    vehicleId,
    renterName: renterName.trim(),
    checkout: stampSide(checkout),
    status: 'out',
    sync: 'pending',
    createdAt: Date.now(),
  };
  const rentals = await loadRentals();
  await saveRentals([rental, ...rentals]);
  void syncAll();
  return rental;
}

export async function saveCheckin(localId: string, checkin: InspectionSide) {
  const rentals = await loadRentals();
  const stamped = stampSide(checkin);
  const next = rentals.map((rental) =>
    rental.localId === localId ? { ...rental, checkin: stamped, status: 'closed' as const, sync: 'pending' as const, syncError: undefined } : rental
  );
  await saveRentals(next);
  void syncAll();
  return next.find((rental) => rental.localId === localId);
}

export async function rememberCover(vehicleId: string, sourceUri: string) {
  const addedAt = stampNow();
  const localUri = await persistMedia(sourceUri, 'jpg');
  const covers = await loadCovers();
  const next = [{ vehicleId, localUri, addedAt, sync: 'pending' as const }, ...covers.filter((cover) => cover.vehicleId !== vehicleId)];
  await saveCovers(next);
  void syncAll();
  return localUri;
}

function readableSyncError(error?: string) {
  if (!error || /expo-file-system|native dependencies|Could not read the saved photo/i.test(error)) return '';
  return error;
}

let lastUploadError = '';

async function uploadRef(ref: PhotoRef, folder: string) {
  if (ref.remoteUrl) return ref;
  try {
    const remoteUrl = await uploadFile(ref.localUri, `${folder}/${ref.id}.jpg`, contentTypeFor(ref.localUri));
    return { ...ref, remoteUrl };
  } catch (error) {
    lastUploadError = error instanceof Error ? error.message : 'Upload failed';
    return ref;
  }
}

async function uploadSide(side: InspectionSide, folder: string): Promise<InspectionSide> {
  const spots = {} as Record<SpotId, SpotRecord>;
  for (const spot of SPOTS) {
    const current = side.spots[spot.id];
    const photos: PhotoRef[] = [];
    for (const photo of current.photos) {
      photos.push(await uploadRef(photo, `${folder}/${spot.id}`));
    }
    spots[spot.id] = { ...current, photos };
  }
  let videoUrl = side.videoUrl;
  if (side.videoUri && !videoUrl) {
    try {
      videoUrl = await uploadFile(side.videoUri, `${folder}/walkaround.mp4`, contentTypeFor(side.videoUri));
    } catch (error) {
      lastUploadError = error instanceof Error ? error.message : 'Upload failed';
      videoUrl = undefined;
    }
  }
  return { ...side, spots, videoUrl };
}

function sidePayload(side: InspectionSide) {
  return {
    date: side.date,
    fuel: side.fuel,
    miles: side.miles,
    hours: side.hours,
    notes: side.notes,
    notesAt: side.notesAt ?? null,
    savedAt: side.savedAt ?? null,
    videoUrl: side.videoUrl ?? null,
    videoAddedAt: side.videoAddedAt ?? null,
    spots: Object.fromEntries(
      SPOTS.map((spot) => [
        spot.id,
        {
          status: side.spots[spot.id].status,
          note: side.spots[spot.id].note,
          notedAt: side.spots[spot.id].notedAt ?? null,
          photos: side.spots[spot.id].photos
            .filter((photo) => photo.remoteUrl)
            .map((photo) => ({ url: photo.remoteUrl, addedAt: photo.addedAt ?? null })),
        },
      ])
    ),
  };
}

function rentalHasStoredFiles(rental: LocalRental) {
  const sides = [rental.checkout, rental.checkin].filter((side): side is InspectionSide => !!side);
  return sides.some(
    (side) => isStoredFile(side.videoUri) || SPOTS.some((spot) => side.spots[spot.id].photos.some((photo) => isStoredFile(photo.localUri)))
  );
}

function sideSettled(side: InspectionSide) {
  const photosReady = SPOTS.every((spot) => side.spots[spot.id].photos.every((photo) => photo.remoteUrl && !isStoredFile(photo.localUri)));
  return photosReady && !isStoredFile(side.videoUri);
}

async function releaseSide(side: InspectionSide): Promise<InspectionSide> {
  const spots = {} as Record<SpotId, SpotRecord>;
  for (const spot of SPOTS) {
    const photos: PhotoRef[] = [];
    for (const photo of side.spots[spot.id].photos) {
      if (photo.remoteUrl && isStoredFile(photo.localUri) && (await remoteMediaLoads(photo.remoteUrl, 'image'))) {
        await deleteStoredFile(photo.localUri);
        photos.push({ ...photo, localUri: '' });
        continue;
      }
      photos.push(photo);
    }
    spots[spot.id] = { ...side.spots[spot.id], photos };
  }
  let videoUri = side.videoUri;
  if (side.videoUrl && isStoredFile(videoUri) && (await remoteMediaLoads(side.videoUrl, 'video'))) {
    await deleteStoredFile(videoUri);
    videoUri = undefined;
  }
  return { ...side, spots, videoUri };
}

async function pushRental(rental: LocalRental) {
  lastUploadError = '';
  const folder = `rentals/${rental.vehicleId}/${rental.localId}`;
  const checkout = await uploadSide(rental.checkout, `${folder}/out`);
  const checkin = rental.checkin ? await uploadSide(rental.checkin, `${folder}/in`) : undefined;
  const payload = {
    vehicleId: rental.vehicleId,
    localId: rental.localId,
    renterName: rental.renterName,
    checkout: sidePayload(checkout),
    checkin: checkin ? sidePayload(checkin) : null,
    checkoutDate: formatDay(checkout.date),
    checkinDate: checkin ? formatDay(checkin.date) : null,
    status: rental.status === 'closed' ? 'Checked In' : 'Checked Out',
  };

  let remoteId = rental.remoteId;
  if (!remoteId) {
    const created = await addDoc(collection(db, 'rentals'), { ...payload, createdAt: serverTimestamp() });
    remoteId = created.id;
  } else {
    await updateDoc(doc(db, 'rentals', remoteId), payload);
  }

  await updateDoc(doc(db, 'vehicles', rental.vehicleId), {
    status: rental.status === 'closed' ? 'Available' : 'Out on rent',
    renterName: rental.status === 'closed' ? deleteField() : rental.renterName,
  });

  const storedCheckout = await releaseSide(checkout);
  const storedCheckin = checkin ? await releaseSide(checkin) : undefined;
  const ready = sideSettled(storedCheckout) && (!storedCheckin || sideSettled(storedCheckin));
  const rentals = await loadRentals();
  await saveRentals(
    rentals.map((item) =>
      item.localId === rental.localId
        ? { ...item, checkout: storedCheckout, checkin: storedCheckin, remoteId, sync: ready ? 'synced' : 'pending', syncError: ready ? undefined : readableSyncError(lastUploadError) || undefined }
        : item
    )
  );
}

async function pushCovers() {
  const covers = await loadCovers();
  const next: CoverPhoto[] = [];
  for (const cover of covers) {
    try {
      const remoteUrl = cover.remoteUrl ?? (await uploadFile(cover.localUri, `vehicles/${cover.vehicleId}/cover.jpg`, contentTypeFor(cover.localUri)));
      if (!cover.remoteUrl) {
        await updateDoc(doc(db, 'vehicles', cover.vehicleId), { photoUrl: remoteUrl, photoAddedAt: cover.addedAt ?? null });
      }
      if (await remoteMediaLoads(remoteUrl, 'image')) {
        await deleteStoredFile(cover.localUri);
        continue;
      }
      next.push({ ...cover, remoteUrl, sync: 'pending' });
    } catch {
      next.push({ ...cover, sync: cover.remoteUrl ? 'pending' : 'error' });
    }
  }
  await saveCovers(next);
}

let syncing = false;
let queued = false;

export async function syncAll() {
  if (syncing) {
    queued = true;
    return;
  }
  syncing = true;
  try {
    do {
      queued = false;
      const net = await NetInfo.fetch();
      if (net.isConnected === false) return;
      await pushCovers();
      const rentals = await loadRentals();
      for (const rental of rentals) {
        if (rental.sync === 'synced' && !rentalHasStoredFiles(rental)) continue;
        try {
          await pushRental(rental);
        } catch (error) {
          const message = readableSyncError(error instanceof Error ? error.message : 'Upload failed');
          const latest = await loadRentals();
          await saveRentals(latest.map((item) => (item.localId === rental.localId ? { ...item, sync: message ? 'error' : 'pending', syncError: message || undefined } : item)));
        }
      }
    } while (queued);
  } finally {
    syncing = false;
  }
}

export function watchConnection() {
  const unsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) void syncAll();
  });
  if (typeof window === 'undefined') return unsub;
  const online = () => void syncAll();
  const visible = () => {
    if (document.visibilityState === 'visible') void syncAll();
  };
  window.addEventListener('online', online);
  document.addEventListener('visibilitychange', visible);
  return () => {
    unsub();
    window.removeEventListener('online', online);
    document.removeEventListener('visibilitychange', visible);
  };
}

export async function keepPhoto(uri: string) {
  const localUri = await persistMedia(uri, 'jpg');
  return { id: id(), localUri, addedAt: stampNow() } satisfies PhotoRef;
}

export async function keepVideo(uri: string) {
  return { uri: await persistMedia(uri, 'mp4'), addedAt: stampNow() };
}
