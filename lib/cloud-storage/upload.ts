import { Storage } from '@google-cloud/storage';
import { UploadProgress } from '../types';

const storage = new Storage();
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '');

export async function uploadVideo(
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<string> {
  if (!process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
    throw new Error('Google Cloud Storage bucket not configured');
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Create a unique filename to prevent collisions
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `videos/${timestamp}-${safeName}`;
      const blob = bucket.file(filename);

      // Get the array buffer directly from the file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const stream = blob.createWriteStream({
        resumable: true,
        contentType: file.type,
        metadata: {
          originalname: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        },
      });

      let bytesWritten = 0;
      const totalBytes = buffer.length;

      stream.on('error', (error) => {
        console.error('Upload stream error:', error);
        onProgress({ status: 'error', progress: 0 });
        reject(error);
      });

      stream.on('progress', ({ bytesWritten: bytes }) => {
        bytesWritten = bytes;
        const progress = Math.round((bytesWritten / totalBytes) * 100);
        onProgress({ status: 'uploading', progress });
      });

      stream.on('finish', () => {
        onProgress({ status: 'completed', progress: 100 });
        resolve(`gs://${bucket.name}/${filename}`);
      });

      // Write the buffer to the stream
      stream.end(buffer);
    } catch (error) {
      console.error('Upload error:', error);
      onProgress({ status: 'error', progress: 0 });
      reject(error);
    }
  });
} 