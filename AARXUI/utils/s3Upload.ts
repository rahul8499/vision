import Constants from 'expo-constants';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';

export type UploadableFile = {
  uri: string;
  name: string;
  type: string;
};

export async function uploadFileToS3(
  file: UploadableFile,
  folder: string,
  token: string,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const presignResponse = await fetch(`${BASE_URL}/api/s3/presigned-upload/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folder,
          filename: file.name,
          content_type: file.type,
        }),
      });

      if (!presignResponse.ok) {
        throw new Error(`Could not prepare upload (${presignResponse.status}).`);
      }

      const { upload_url, key } = await presignResponse.json();
      const localResponse = await fetch(file.uri);
      if (!localResponse.ok) throw new Error('Selected file could not be opened.');
      const body = await localResponse.blob();
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body,
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed (${uploadResponse.status}).`);
      }
      return key as string;
    } catch (error) {
      lastError = error;
    }
  }

  console.error('Direct S3 upload failed:', lastError);
  throw new Error('File upload nahi ho paya. Network check karke Retry karein.');
}
