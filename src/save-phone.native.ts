import { Directory } from 'expo-file-system';

export async function saveWithPhoneFiles(file: File) {
  const directory = await Directory.pickDirectoryAsync();
  const stored = directory.createFile(file.name, 'application/zip');
  await stored.write(new Uint8Array(await file.arrayBuffer()));
  return 'saved' as const;
}
