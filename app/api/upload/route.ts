import { NextRequest } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import type { VideoUploadResponse } from '@/lib/types';
import { Readable } from 'stream';

// Increase the body size limit for this API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Set desired limit (e.g., '100mb')
    },
  },
};

const storage = new Storage();
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '');

export async function POST(request: NextRequest): Promise<Response> {
  console.log("API Route /api/upload POST handler invoked.");
  console.log("Request Headers:", JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));

  try {
    if (!process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
      throw new Error('Google Cloud Storage bucket not configured');
    }

    console.log("Attempting to parse formData...");
    const formData = await request.formData();
    console.log("FormData parsing successful.");
    const file = formData.get('file') as File;

    if (!file) {
      console.error("No file found in formData.");
      return Response.json(
        { success: false, error: 'No file provided' } as VideoUploadResponse,
        { status: 400 }
      );
    }

    console.log(`File details: Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      console.warn(`Invalid file type detected: ${file.type}`);
      return Response.json(
        { success: false, error: 'Invalid file type. Please upload MP4, WebM, or MOV file.' } as VideoUploadResponse,
        { status: 400 }
      );
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      console.warn(`File size exceeds limit: ${file.size} bytes > ${maxSize} bytes`);
      return Response.json(
        { success: false, error: 'File too large. Maximum size is 100MB.' } as VideoUploadResponse,
        { status: 400 }
      );
    }

    // Create a unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `videos/${timestamp}-${safeName}`;
    const blob = bucket.file(filename);

    console.log(`Attempting to upload to GCS: gs://${bucket.name}/${filename}`);
    // Upload to Cloud Storage using stream piping
    await new Promise((resolve, reject) => {
      const stream = blob.createWriteStream({
        resumable: false, // Consider setting to true for large files / unreliable networks
        contentType: file.type,
        metadata: {
          originalname: file.name,
          size: file.size, // Size is still useful metadata, even if not buffering
          uploadedAt: new Date().toISOString(),
        },
      });

      stream.on('error', (err) => {
        console.error('GCS Stream Error:', err);
        reject(new Error('Failed to upload file to storage.')); // More specific error
      });
      stream.on('finish', resolve);

      // Pipe the file stream directly to the GCS stream
      const fileStream = file.stream(); // Get a ReadableStream from the File object
      const nodeStream = Readable.fromWeb(fileStream as any); // Convert to Node.js stream (requires Node >= 18)
      nodeStream.pipe(stream);
    });

    console.log("GCS upload successful.");
    const gcsUri = `gs://${bucket.name}/${filename}`;

    return Response.json(
      { success: true, gcsUri } as VideoUploadResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('--- Upload API Error Caught ---');
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error Message:', errorMessage);
    console.error('--- End Upload API Error ---');

    return Response.json(
      { success: false, error: errorMessage } as VideoUploadResponse,
      { status: 500 }
    );
  }
} 