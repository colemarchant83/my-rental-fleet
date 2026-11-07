import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import * as FileSystem from "expo-file-system";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.EXPO_PUBLIC_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.EXPO_PUBLIC_R2_BUCKET!;

export async function uploadFile(localUri: string, key: string, contentType: string) {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  // Public URL (works if you set the bucket to public later, or use a custom domain)
  return `${process.env.EXPO_PUBLIC_R2_ENDPOINT}/${BUCKET}/${key}`;
}