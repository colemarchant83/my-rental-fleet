import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { currentOwnerId } from './account';
import { contentTypeFor, deleteStoredFile, fingerprint, isStoredFile, mediaByteSize, persistMedia, remoteMediaLoads } from './media';
import { beginUpload, deleteStoredObject } from './r2';
import { reportProblem } from './problem-report';

export const SPOTS = [
  { id: 'tires', label: 'Tires & wheels' },
  { id: 'front', label: 'Body — front' },
  { id: 'left', label: 'Body — left side' },
  { id: 'right', label: 'Body — right side' },
  { id: 'rear', label: 'Body — rear' },
  { id: 'windshield', label: 'Windows' },
  { id: 'accessories', label: 'Accessories & gear' },
  { id: 'other', label: 'Other' },
] as const;

export type SpotId = (typeof SPOTS)[number]['id'];

export type PhotoRef = {
  id: string;
  localUri: string;
  remoteUrl?: string;
  addedAt?: string;
  serverAddedAt?: string;
  sha256?: string;
  sha256Mismatch?: boolean;
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
  serverSavedAt?: string;
  videoUri?: string;
  videoUrl?: string;
  videoAddedAt?: string;
  videoServerAddedAt?: string;
  videoSha256?: string;
  videoOverLimit?: boolean;
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
  serverReceivedAt?: number;
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
const VEHICLES_KEY = 'fleet.vehicles.v1';
const VEHICLE_CACHE = 'fleet-data-v1';
const VEHICLE_CACHE_URL = '/__fleet_vehicles.json';

export type CachedVehicle = {
  id: string;
  nickname?: string;
  yearMakeModel?: string;
  specs?: string;
  vin?: string;
  ownerId?: string;
  status?: string;
  renterName?: string;
  photoUrl?: string;
  photoAddedAt?: string;
};

export function vehicleIdLine(value?: string) {
  const raw = (value || '').trim().toUpperCase();
  if (!raw) return '';
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) return `VIN ${compact}`;
  return `Hull ${raw}`;
}

async function readVehicleCache(url = VEHICLE_CACHE_URL) {
  if (typeof caches === 'undefined') return [] as CachedVehicle[];
  const cache = await caches.open(VEHICLE_CACHE);
  const response = await cache.match(url);
  if (!response) return [] as CachedVehicle[];
  const data = (await response.json()) as CachedVehicle[];
  return Array.isArray(data) ? data : [];
}

async function writeVehicleCache(vehicles: CachedVehicle[], url = VEHICLE_CACHE_URL) {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(VEHICLE_CACHE);
  await cache.put(url, new Response(JSON.stringify(vehicles), { headers: { 'Content-Type': 'application/json' } }));
}

function vehicleCacheKey() {
  const uid = auth.currentUser?.uid;
  return uid ? `${VEHICLES_KEY}.${uid}` : '';
}

export async function loadCachedVehicles() {
  const uid = auth.currentUser?.uid;
  const key = vehicleCacheKey();
  if (!uid || !key) return [];
  const url = `${VEHICLE_CACHE_URL}?owner=${uid}`;
  const stored = await readJson<CachedVehicle[]>(key, []);
  const cached = await readVehicleCache(url).catch(() => [] as CachedVehicle[]);
  const scoped = (cached.length >= stored.length ? cached : stored).filter((item) => item.ownerId === uid);
  if (scoped.length) return scoped;
  const legacyStored = await readJson<CachedVehicle[]>(VEHICLES_KEY, []);
  const legacyCached = await readVehicleCache().catch(() => [] as CachedVehicle[]);
  const legacy = (legacyCached.length >= legacyStored.length ? legacyCached : legacyStored).filter((item) => item.ownerId === uid);
  if (legacy.length) await saveCachedVehicles(legacy);
  return legacy;
}

export async function saveCachedVehicles(vehicles: CachedVehicle[], allowEmpty = false) {
  const uid = auth.currentUser?.uid;
  const key = vehicleCacheKey();
  if (!uid || !key) return;
  const mine = vehicles.filter((item) => item.ownerId === uid);
  if (!mine.length && !allowEmpty) return;
  await AsyncStorage.setItem(key, JSON.stringify(mine));
  await writeVehicleCache(mine, `${VEHICLE_CACHE_URL}?owner=${uid}`).catch(() => undefined);
  emit();
}

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

export function clocksDisagree(phone?: string, server?: string) {
  if (!phone || !server) return false;
  const left = Date.parse(phone);
  const right = Date.parse(server);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return Math.abs(left - right) > 5 * 60 * 1000;
}

async function serverNow() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return undefined;
  try {
    const ref = await addDoc(collection(db, 'clock'), { at: serverTimestamp() });
    const snap = await getDoc(ref);
    await deleteDoc(ref).catch(() => undefined);
    const at = snap.get('at') as { toMillis?: () => number } | undefined;
    const ms = at?.toMillis?.();
    return ms ? new Date(ms).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

/** Phone time plus the server clock. The server time stays empty when there is no connection. */
export async function proofTimes() {
  const savedAt = stampNow();
  const serverSavedAt = await serverNow();
  return { savedAt, serverSavedAt };
}

/** Stamp the inspection at the moment it is saved. Photo times are already set when each photo was added. */
export async function stampSide(side: InspectionSide): Promise<InspectionSide> {
  const savedAt = stampNow();
  const serverSavedAt = await serverNow();
  const spots = {} as Record<SpotId, SpotRecord>;
  for (const spot of SPOTS) {
    const current = side.spots[spot.id] ?? { status: '' as const, note: '', photos: [] };
    spots[spot.id] = { ...current, notedAt: current.note.trim() ? current.notedAt || savedAt : undefined };
  }
  return { ...side, savedAt, serverSavedAt, notesAt: side.notes.trim() ? side.notesAt || savedAt : undefined, spots };
}

export function formatDay(iso?: string) {
  if (!iso) return '';
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
  const rentals = await readJson<LocalRental[]>(RENTALS_KEY, []);
  return rentals.map((rental) => ({
    ...rental,
    checkout: ensureSide(rental.checkout),
    checkin: rental.checkin ? ensureSide(rental.checkin) : undefined,
  }));
}

function ensureSide(side?: InspectionSide): InspectionSide {
  if (!side?.spots) return emptySide(side?.date);
  let missing = false;
  const spots = { ...side.spots };
  for (const spot of SPOTS) {
    if (!spots[spot.id]) {
      spots[spot.id] = { status: '', note: '', photos: [] };
      missing = true;
    }
  }
  return missing ? { ...side, spots } : side;
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

const HISTORY_ON_PHONE = 20;

async function prunePhoneRentals(rentals: LocalRental[]) {
  const keep = new Set<string>();
  const closedByVehicle = new Map<string, LocalRental[]>();
  for (const rental of rentals) {
    if (rental.status === 'out' || rental.sync !== 'synced' || rentalHasStoredFiles(rental)) {
      keep.add(rental.localId);
      continue;
    }
    const list = closedByVehicle.get(rental.vehicleId) ?? [];
    list.push(rental);
    closedByVehicle.set(rental.vehicleId, list);
  }
  for (const list of closedByVehicle.values()) {
    list.sort((a, b) => b.createdAt - a.createdAt);
    for (const rental of list.slice(0, HISTORY_ON_PHONE)) keep.add(rental.localId);
  }
  const next = rentals.filter((rental) => keep.has(rental.localId));
  if (next.length !== rentals.length) await saveRentals(next);
  return next;
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
    checkout: await stampSide(checkout),
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
  const stamped = await stampSide(checkin);
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
  if (/abort|did not finish/i.test(error)) return 'The video is still on this phone. Leave this screen open while it uploads.';
  return error;
}

let lastUploadError = '';

async function uploadRef(ref: PhotoRef, folder: string, receivedAt?: string) {
  if (ref.remoteUrl) return ref;
  try {
    const remoteUrl = await beginUpload(ref.localUri, `${folder}/${ref.id}.jpg`, contentTypeFor(ref.localUri));
    return { ...ref, remoteUrl, serverAddedAt: ref.serverAddedAt || receivedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    lastUploadError = /Could not read the saved photo/i.test(message)
      ? 'A photo is still on this phone. It will be sent again. Nothing was deleted.'
      : message;
    return ref;
  }
}

const VIDEO_LIMIT = 100 * 1000 * 1000;

async function noteLargeVideo(bytes: number, folder: string) {
  await addDoc(collection(db, 'uploadAlerts'), {
    kind: 'video-over-100mb',
    bytes,
    folder,
    ownerId: currentOwnerId(),
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
}

async function uploadSide(side: InspectionSide, folder: string, onStep?: (side: InspectionSide) => Promise<void>): Promise<InspectionSide> {
  const receivedAt = await serverNow();
  const spots = { ...side.spots } as Record<SpotId, SpotRecord>;
  let currentSide = side;
  for (const spot of SPOTS) {
    const current = side.spots[spot.id] ?? { status: '' as const, note: '', photos: [] };
    const photos: PhotoRef[] = [];
    for (const photo of current.photos) {
      photos.push(await uploadRef(photo, `${folder}/${spot.id}`, receivedAt));
      spots[spot.id] = { ...current, photos: [...photos, ...current.photos.slice(photos.length)] };
      currentSide = { ...side, spots: { ...spots } };
      if (onStep) await onStep(currentSide);
    }
    spots[spot.id] = { ...current, photos };
  }
  let videoUrl = side.videoUrl;
  let videoUri = side.videoUri;
  let videoServerAddedAt = side.videoServerAddedAt;
  let videoOverLimit = side.videoOverLimit;
  if (videoUri && !videoUrl && !videoOverLimit) {
    const bytes = await mediaByteSize(videoUri);
    if (bytes > VIDEO_LIMIT) {
      videoOverLimit = true;
      lastUploadError = 'A video is over 100 MB, so that video stays on this phone and was not uploaded.';
      void noteLargeVideo(bytes, folder);
    } else {
      try {
        videoUrl = await beginUpload(videoUri, `${folder}/walkaround.mp4`, 'video/mp4');
        videoServerAddedAt = side.videoServerAddedAt || receivedAt;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        lastUploadError = /Could not read the saved photo/i.test(message)
          ? 'A video is still on this phone. It will be sent again. Nothing was deleted.'
          : message;
        if (/413/.test(message)) {
          videoOverLimit = true;
          lastUploadError = 'A video is over 100 MB, so that video stays on this phone and was not uploaded.';
          void noteLargeVideo(bytes, folder);
        }
        videoUrl = undefined;
      }
    }
  } else if (videoOverLimit) {
    lastUploadError = 'A video is over 100 MB, so that video stays on this phone and was not uploaded.';
  }
  currentSide = { ...currentSide, spots, videoUrl, videoUri, videoServerAddedAt, videoOverLimit };
  if (onStep) await onStep(currentSide);
  return currentSide;
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
    serverSavedAt: side.serverSavedAt ?? null,
    videoUrl: side.videoUrl ?? null,
    videoAddedAt: side.videoAddedAt ?? null,
    videoServerAddedAt: side.videoServerAddedAt ?? null,
    videoSha256: side.videoSha256 ?? null,
    spots: Object.fromEntries(
      SPOTS.map((spot) => [
        spot.id,
        {
          status: side.spots[spot.id].status,
          note: side.spots[spot.id].note,
          notedAt: side.spots[spot.id].notedAt ?? null,
          photos: side.spots[spot.id].photos
            .filter((photo) => photo.remoteUrl)
            .map((photo) => ({
              url: photo.remoteUrl,
              addedAt: photo.addedAt ?? null,
              serverAddedAt: photo.serverAddedAt ?? null,
              sha256: photo.sha256 ?? null,
            })),
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
  const photosReady = SPOTS.every((spot) => side.spots[spot.id].photos.every((photo) => {
    if (!photo.localUri && !photo.remoteUrl) return true;
    return !!photo.remoteUrl;
  }));
  const videoReady = !side.videoUri || !!side.videoUrl || !!side.videoOverLimit;
  return photosReady && videoReady;
}

async function releaseSide(side: InspectionSide): Promise<InspectionSide> {
  const spots = {} as Record<SpotId, SpotRecord>;
  for (const spot of SPOTS) {
    const current = side.spots[spot.id] ?? { status: '' as const, note: '', photos: [] };
    const photos: PhotoRef[] = [];
    for (const photo of current.photos) {
      if (photo.remoteUrl && isStoredFile(photo.localUri) && (await remoteMediaLoads(photo.remoteUrl, 'image'))) {
        await deleteStoredFile(photo.localUri);
        photos.push({ ...photo, localUri: '' });
        continue;
      }
      photos.push(photo);
    }
    spots[spot.id] = { ...current, photos };
  }
  let videoUri = side.videoUri;
  if (side.videoUrl && isStoredFile(videoUri) && (await remoteMediaLoads(side.videoUrl, 'video'))) {
    await deleteStoredFile(videoUri);
    videoUri = undefined;
  }
  return { ...side, spots, videoUri };
}

async function pushRental(passed: LocalRental) {
  lastUploadError = '';
  const current = async () => (await loadRentals()).find((item) => item.localId === passed.localId);
  let rental = (await current()) ?? passed;
  await saveRentals((await loadRentals()).map((item) => (item.localId === rental.localId ? { ...item, sync: 'pending' as const, syncError: undefined } : item)));
  rental = (await current()) ?? rental;
  const folder = `rentals/${rental.vehicleId}/${rental.localId}`;
  let checkout = rental.checkout;
  let checkin = rental.checkin;
  const remember = async () => {
    const rentals = await loadRentals();
    await saveRentals(rentals.map((item) => {
      if (item.localId !== rental.localId) return item;
      return {
        ...item,
        checkout,
        checkin: checkin ?? item.checkin,
        status: item.status === 'closed' ? item.status : rental.status,
        sync: 'pending' as const,
      };
    }));
  };
  checkout = await uploadSide(rental.checkout, `${folder}/out`, async (next) => {
    checkout = next;
    await remember();
  });
  const afterCheckout = await current();
  if (!checkin && afterCheckout?.checkin) checkin = afterCheckout.checkin;
  if (afterCheckout?.status === 'closed') rental = { ...rental, status: 'closed' };
  if (checkin) {
    checkin = await uploadSide(checkin, `${folder}/in`, async (next) => {
      checkin = next;
      await remember();
    });
  }
  const beforeWrite = await current();
  if (!checkin && beforeWrite?.checkin) {
    checkin = await uploadSide(beforeWrite.checkin, `${folder}/in`, async (next) => {
      checkin = next;
      await remember();
    });
  }
  const status = beforeWrite?.status === 'closed' || rental.status === 'closed' ? 'closed' : rental.status;
  const payload = {
    vehicleId: rental.vehicleId,
    localId: rental.localId,
    renterName: rental.renterName,
    checkout: sidePayload(checkout),
    checkin: checkin ? sidePayload(checkin) : null,
    checkoutDate: formatDay(checkout.date),
    checkinDate: checkin ? formatDay(checkin.date) : null,
    status: status === 'closed' ? 'Checked In' : 'Checked Out',
  };

  let remoteId = rental.remoteId ?? beforeWrite?.remoteId;
  let serverReceivedAt = rental.serverReceivedAt ?? beforeWrite?.serverReceivedAt;
  if (!remoteId) {
    const created = await addDoc(collection(db, 'rentals'), { ...payload, ownerId: currentOwnerId(), createdAt: serverTimestamp(), serverReceivedAt: serverTimestamp() });
    remoteId = created.id;
    const snap = await getDoc(created);
    serverReceivedAt = createdMillis(snap.get('serverReceivedAt')) || serverReceivedAt;
  } else {
    await updateDoc(doc(db, 'rentals', remoteId), payload);
    if (!serverReceivedAt) {
      await updateDoc(doc(db, 'rentals', remoteId), { serverReceivedAt: serverTimestamp() });
      const snap = await getDoc(doc(db, 'rentals', remoteId));
      serverReceivedAt = createdMillis(snap.get('serverReceivedAt')) || undefined;
    }
  }

  await updateDoc(doc(db, 'vehicles', rental.vehicleId), {
    status: status === 'closed' ? 'Available' : 'Out on rent',
    renterName: status === 'closed' ? deleteField() : rental.renterName,
  });

  const freshest = await current();
  const missedCheckin = !!freshest?.checkin?.savedAt && freshest.checkin.savedAt !== checkin?.savedAt;
  const finalStatus = freshest?.status === 'closed' || status === 'closed' ? 'closed' : 'out';
  const finalCheckin = missedCheckin ? freshest?.checkin : checkin;
  const storedCheckout = finalStatus === 'closed' && !missedCheckin ? await releaseSide(checkout) : checkout;
  const storedCheckin = finalStatus === 'closed' && finalCheckin && !missedCheckin ? await releaseSide(finalCheckin) : finalCheckin;
  const ready = !missedCheckin && sideSettled(storedCheckout) && (!storedCheckin || sideSettled(storedCheckin));
  const limitNote = storedCheckout.videoOverLimit || storedCheckin?.videoOverLimit
    ? 'A video is over 100 MB, so that video stays on this phone and was not uploaded.'
    : undefined;
  const rentals = await loadRentals();
  const next = rentals.map((item) =>
    item.localId === rental.localId
      ? { ...item, checkout: storedCheckout, checkin: storedCheckin ?? item.checkin, status: finalStatus, remoteId, serverReceivedAt, sync: ready ? 'synced' as const : 'pending' as const, syncError: ready ? limitNote : readableSyncError(lastUploadError) || undefined }
      : item
  );
  const note = ready ? limitNote : readableSyncError(lastUploadError);
  if (note) void reportProblem(note, 'upload');
  await saveRentals(await prunePhoneRentals(next));
}

async function pushCovers() {
  const covers = await loadCovers();
  const next: CoverPhoto[] = [];
  for (const cover of covers) {
    try {
      const remoteUrl = cover.remoteUrl ?? (await beginUpload(cover.localUri, `vehicles/${cover.vehicleId}/cover.jpg`, contentTypeFor(cover.localUri)));
      if (!cover.remoteUrl) {
        await updateDoc(doc(db, 'vehicles', cover.vehicleId), { photoUrl: remoteUrl, photoAddedAt: cover.addedAt ?? null });
      }
      next.push({ ...cover, remoteUrl, sync: 'synced' });
    } catch {
      next.push(cover);
    }
  }
  await saveCovers(next);
}

async function cacheProfilePhotos() {
  const vehicles = await loadCachedVehicles();
  let covers = await loadCovers();
  let changed = false;
  for (const vehicle of vehicles) {
    const current = covers.find((cover) => cover.vehicleId === vehicle.id);
    if (current && isStoredFile(current.localUri)) continue;
    const remote = current?.remoteUrl || vehicle.photoUrl;
    if (!remote?.startsWith('http')) continue;
    try {
      const localUri = await persistMedia(remote, 'jpg');
      covers = [
        { vehicleId: vehicle.id, localUri, remoteUrl: remote, addedAt: current?.addedAt || vehicle.photoAddedAt, sync: 'synced' as const },
        ...covers.filter((cover) => cover.vehicleId !== vehicle.id),
      ];
      changed = true;
    } catch {
      // The photo stays remote until the next time the phone has service.
    }
  }
  if (changed) await saveCovers(covers);
}

let syncing = false;
let queued = false;

export async function syncAll() {
  if (syncing) {
    queued = true;
    return;
  }
  try {
    currentOwnerId();
  } catch {
    return;
  }
  syncing = true;
  const tried = new Set<string>();
  try {
    do {
      queued = false;
      const net = await NetInfo.fetch();
      if (net.isConnected === false && (typeof navigator === 'undefined' || navigator.onLine === false)) return;
      await pushCovers();
      await cacheProfilePhotos();
      const rentals = await loadRentals();
      for (const rental of rentals) {
        if (rental.sync === 'synced') continue;
        try {
          await pushRental(rental);
          const latest = (await loadRentals()).find((item) => item.localId === rental.localId);
          if (latest && latest.sync !== 'synced' && !tried.has(rental.localId) && !/100 MB/.test(latest.syncError || '')) {
            tried.add(rental.localId);
            queued = true;
          }
        } catch (error) {
          const message = readableSyncError(error instanceof Error ? error.message : 'Upload failed');
          if (message) void reportProblem(message, 'upload');
          const latest = await loadRentals();
          await saveRentals(latest.map((item) => (item.localId === rental.localId ? { ...item, sync: message ? 'error' : 'pending', syncError: message || undefined } : item)));
          if (!tried.has(rental.localId)) {
            tried.add(rental.localId);
            queued = true;
          }
        }
      }
      await prunePhoneRentals(await loadRentals());
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
  const [sha256, serverAddedAt] = await Promise.all([fingerprint(localUri), serverNow()]);
  return { id: id(), localUri, addedAt: stampNow(), serverAddedAt, sha256 } satisfies PhotoRef;
}

export async function keepVideo(uri: string) {
  const localUri = await persistMedia(uri, 'mp4');
  const serverAddedAt = await serverNow();
  return { uri: localUri, addedAt: stampNow(), serverAddedAt, sha256: undefined as string | undefined };
}

function createdMillis(value: unknown) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value && typeof value === 'object' && 'seconds' in value) return Number((value as { seconds: number }).seconds) * 1000;
  return 0;
}

function sideFromRemote(raw: Partial<InspectionSide> & { spots?: Record<string, { status?: string; note?: string; notedAt?: string; photos?: (string | { url?: string; addedAt?: string; serverAddedAt?: string; sha256?: string })[] }> }, fallbackDate: string): InspectionSide {
  const spots = {} as InspectionSide['spots'];
  for (const spot of SPOTS) {
    const found = raw.spots?.[spot.id];
    spots[spot.id] = {
      status: found?.status === 'issue' ? 'issue' : found?.status === 'ok' ? 'ok' : '',
      note: found?.note || '',
      notedAt: found?.notedAt,
      photos: (found?.photos || []).map((photo, index) => {
        const url = typeof photo === 'string' ? photo : photo.url || '';
        const addedAt = typeof photo === 'string' ? undefined : photo.addedAt;
        const serverAddedAt = typeof photo === 'string' ? undefined : photo.serverAddedAt;
        const sha256 = typeof photo === 'string' ? undefined : photo.sha256;
        return { id: `${spot.id}-${index}`, localUri: '', remoteUrl: url, addedAt, serverAddedAt, sha256 };
      }).filter((photo) => photo.remoteUrl),
    };
  }
  return {
    date: raw.date || fallbackDate,
    fuel: raw.fuel || 'Not recorded',
    miles: raw.miles || '',
    hours: raw.hours || '',
    notes: raw.notes || '',
    notesAt: raw.notesAt,
    savedAt: raw.savedAt,
    serverSavedAt: raw.serverSavedAt,
    videoUrl: raw.videoUrl,
    videoAddedAt: raw.videoAddedAt,
    videoServerAddedAt: raw.videoServerAddedAt,
    videoSha256: raw.videoSha256,
    spots,
  };
}

function rentalFromDoc(remoteId: string, data: Record<string, unknown>): LocalRental {
  const checkout = (data.checkout ?? {}) as Partial<InspectionSide> & { savedAt?: string; spots?: InspectionSide['spots'] };
  const checkinRaw = data.checkin as (Partial<InspectionSide> & { spots?: InspectionSide['spots'] }) | null;
  return {
    localId: String(data.localId || remoteId),
    remoteId,
    vehicleId: String(data.vehicleId || ''),
    renterName: String(data.renterName || ''),
    status: data.status === 'Checked In' || checkinRaw ? 'closed' : 'out',
    sync: 'synced',
    createdAt: createdMillis(data.createdAt) || Date.parse(String(checkout.savedAt || '')) || 0,
    serverReceivedAt: createdMillis(data.serverReceivedAt) || undefined,
    checkout: sideFromRemote(checkout, String(data.checkoutDate || '')),
    checkin: checkinRaw ? sideFromRemote(checkinRaw, String(data.checkinDate || '')) : undefined,
  };
}

export async function fetchVehicleRentals(vehicleId: string) {
  const uid = currentOwnerId();
  const snap = await getDocs(query(collection(db, 'rentals'), where('vehicleId', '==', vehicleId)));
  return snap.docs
    .map((item) => rentalFromDoc(item.id, item.data() as Record<string, unknown>))
    .filter((item, index) => {
      const owner = snap.docs[index]?.get('ownerId');
      return !owner || owner === uid;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteVehicleRecord(vehicleId: string) {
  const remote = await fetchVehicleRentals(vehicleId).catch(() => [] as LocalRental[]);
  const local = (await loadRentals()).filter((rental) => rental.vehicleId === vehicleId);
  const seen = new Set<string>();
  for (const rental of [...local, ...remote]) {
    const key = rental.remoteId || rental.localId;
    if (seen.has(key)) continue;
    seen.add(key);
    await deleteRental(rental);
  }
  const covers = await loadCovers();
  const cover = covers.find((item) => item.vehicleId === vehicleId);
  if (cover) {
    await deleteStoredFile(cover.localUri);
    await deleteStoredObject(cover.remoteUrl);
  }
  await saveCovers(covers.filter((item) => item.vehicleId !== vehicleId));
  const snap = await getDoc(doc(db, 'vehicles', vehicleId)).catch(() => null);
  const photoUrl = snap?.exists() ? String(snap.get('photoUrl') || '') : '';
  if (photoUrl) await deleteStoredObject(photoUrl);
  await deleteDoc(doc(db, 'vehicles', vehicleId));
  const cached = (await loadCachedVehicles()).filter((item) => item.id !== vehicleId);
  await saveCachedVehicles(cached, true);
}

export async function fetchRentalByLocalId(localId: string) {
  const uid = currentOwnerId();
  const snap = await getDocs(query(collection(db, 'rentals'), where('localId', '==', localId)));
  const first = snap.docs.find((item) => !item.get('ownerId') || item.get('ownerId') === uid);
  return first ? rentalFromDoc(first.id, first.data() as Record<string, unknown>) : undefined;
}
