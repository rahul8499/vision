import Constants from 'expo-constants';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';

export type UploadableFile = {
  uri: string;
  name: string;
  type: string;
};

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_UPLOAD_ATTEMPTS = 3;

async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function uploadFileToS3(
  file: UploadableFile,
  folder: string,
  token: string,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const presignResponse = await fetchWithTimeout(`${BASE_URL}/api/s3/presigned-upload/`, {
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
      const localResponse = await fetchWithTimeout(file.uri);
      if (!localResponse.ok) throw new Error('Selected file could not be opened.');
      const body = await localResponse.blob();
      const uploadResponse = await fetchWithTimeout(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body,
      }, 45_000);

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed (${uploadResponse.status}).`);
      }
      return key as string;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_UPLOAD_ATTEMPTS - 1) {
        await wait(750 * (attempt + 1));
      }
    }
  }

  console.error('Direct S3 upload failed:', lastError);
  throw new Error('File upload nahi ho paya. Network check karke Retry karein.');
}
