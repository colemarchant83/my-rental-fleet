import { SPOTS, type InspectionSide, type LocalRental, type PhotoRef } from './fleet-store';
import { uploadFile } from './r2';

const APP = 'https://my-rental-fleet.web.app';
const SIGNER = (process.env.EXPO_PUBLIC_R2_SIGNER ?? 'https://my-rental-fleet-media.colemarchant.workers.dev').replace(/\/$/, '');

export type SharedCard = {
  renterName: string;
  machineName: string;
  yearMakeModel?: string;
  vin?: string;
  checkout: InspectionSide;
  checkin?: InspectionSide;
  serverReceivedAt?: number;
  status: 'out' | 'closed';
};

export type SharedMaintenance = {
  kind: 'maintenance';
  work: string;
  date: string;
  notes: string;
  notesAt?: string;
  miles: string;
  hours: string;
  cost: string;
  savedAt: string;
  serverSavedAt?: string;
  machineName: string;
  yearMakeModel?: string;
  vin?: string;
  photos: PhotoRef[];
};

export function isMaintenanceShare(value: SharedCard | SharedMaintenance): value is SharedMaintenance {
  return (value as SharedMaintenance).kind === 'maintenance';
}

function publicSide(side: InspectionSide): InspectionSide {
  const spots = {} as InspectionSide['spots'];
  for (const spot of SPOTS) {
    const current = side.spots[spot.id] ?? { status: '' as const, note: '', photos: [] };
    spots[spot.id] = {
      ...current,
      photos: current.photos
        .filter((photo) => photo.remoteUrl)
        .map((photo) => ({ ...photo, localUri: '' })),
    };
  }
  return { ...side, videoUri: side.videoUrl ? undefined : side.videoUri, spots };
}

export function cardReadyToShare(rental: LocalRental) {
  const sides = [rental.checkout, rental.checkin].filter((side): side is InspectionSide => !!side);
  return sides.every((side) => {
    const photosReady = SPOTS.every((spot) => side.spots[spot.id].photos.every((photo) => !photo.localUri || !!photo.remoteUrl));
    const videoReady = !side.videoUri || !!side.videoUrl || !!side.videoOverLimit;
    return photosReady && videoReady;
  });
}

export async function publishShareLink(rental: LocalRental, machine?: { nickname?: string; yearMakeModel?: string; vin?: string }) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const payload: SharedCard = {
    renterName: rental.renterName,
    machineName: machine?.nickname || machine?.yearMakeModel || 'Machine',
    yearMakeModel: machine?.yearMakeModel,
    vin: machine?.vin,
    checkout: publicSide(rental.checkout),
    checkin: rental.checkin ? publicSide(rental.checkin) : undefined,
    serverReceivedAt: rental.serverReceivedAt,
    status: rental.status,
  };
  const file = new File([JSON.stringify(payload)], 'card.json', { type: 'application/json' });
  const localUrl = URL.createObjectURL(file);
  try {
    await uploadFile(localUrl, `shares/${token}.json`, 'application/json');
  } finally {
    URL.revokeObjectURL(localUrl);
  }
  return `${APP}/share?id=${token}`;
}

export function maintenanceReadyToShare(photos: PhotoRef[]) {
  return photos.every((photo) => !photo.localUri || !!photo.remoteUrl);
}

export async function publishMaintenanceShare(
  record: {
    work: string;
    date: string;
    notes: string;
    notesAt?: string;
    miles: string;
    hours: string;
    cost: string;
    savedAt: string;
    serverSavedAt?: string;
    photos: PhotoRef[];
  },
  machine?: { nickname?: string; yearMakeModel?: string; vin?: string },
) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const payload: SharedMaintenance = {
    kind: 'maintenance',
    work: record.work,
    date: record.date,
    notes: record.notes,
    notesAt: record.notesAt,
    miles: record.miles,
    hours: record.hours,
    cost: record.cost,
    savedAt: record.savedAt,
    serverSavedAt: record.serverSavedAt,
    machineName: machine?.nickname || machine?.yearMakeModel || 'Machine',
    yearMakeModel: machine?.yearMakeModel,
    vin: machine?.vin,
    photos: record.photos.filter((photo) => photo.remoteUrl).map((photo) => ({ ...photo, localUri: '' })),
  };
  const file = new File([JSON.stringify(payload)], 'card.json', { type: 'application/json' });
  const localUrl = URL.createObjectURL(file);
  try {
    await uploadFile(localUrl, `shares/${token}.json`, 'application/json');
  } finally {
    URL.revokeObjectURL(localUrl);
  }
  return `${APP}/share?id=${token}`;
}

export async function loadSharedCard(token: string): Promise<SharedCard | SharedMaintenance> {
  const response = await fetch(`${SIGNER}/media/shares/${token}.json`);
  if (!response.ok) throw new Error('This link could not be opened.');
  return response.json() as Promise<SharedCard | SharedMaintenance>;
}
