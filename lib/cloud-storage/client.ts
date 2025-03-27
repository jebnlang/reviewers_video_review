import { Storage } from '@google-cloud/storage';
import { existsSync } from 'fs';
import { join } from 'path';

// Check for required environment variables
if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
  throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
}

if (!process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
  throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET environment variable is not set');
}

// Check for credentials file
const credentialsPath = join(process.cwd(), 'service-account-key.json');
if (!existsSync(credentialsPath)) {
  throw new Error(
    'Google Cloud credentials file (service-account-key.json) not found. ' +
    'Please add it to the project root directory.'
  );
}

// Initialize storage client
export const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: credentialsPath,
});

// Get bucket reference
export const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);

// Generate a signed URL for temporary access
export async function getSignedUrl(fileName: string, action: 'read' | 'write' = 'read'): Promise<string> {
  const file = bucket.file(fileName);
  
  const options = {
    version: 'v4' as const,
    action: action,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  };

  const [url] = await file.getSignedUrl(options);
  return url;
} 