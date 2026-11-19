export type PhoneSave = { relativePath: string; localUri?: string; remoteUrl?: string; text?: string };

export async function saveWithPhoneFiles(_file: File): Promise<'saved'> {
  throw new Error('Saving straight to Files is part of the phone app.');
}

export async function savePhoneFolder(_folderName: string, _files: PhoneSave[], _html?: (previews: Record<string, string>) => { name: string; text: string }) {
  throw new Error('Saving straight to Files is part of the phone app.');
  return { missing: [] as string[], saved: 0, folderName: '' };
}
