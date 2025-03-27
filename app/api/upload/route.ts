import { NextRequest } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import type { VideoUploadResponse } from '@/lib/types';

const storage = new Storage();
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '');

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
      throw new Error('Google Cloud Storage bucket not configured');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json(
        { success: false, error: 'No file provided' } as VideoUploadResponse,
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      return Response.json(
        { success: false, error: 'Invalid file type. Please upload MP4, WebM, or MOV file.' } as VideoUploadResponse,
        { status: 400 }
      );
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
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

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloud Storage
    await new Promise((resolve, reject) => {
      const stream = blob.createWriteStream({
        resumable: false,
        contentType: file.type,
        metadata: {
          originalname: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        },
      });

      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(buffer);
    });

    const gcsUri = `gs://${bucket.name}/${filename}`;

    return Response.json(
      { success: true, gcsUri } as VideoUploadResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return Response.json(
      { success: false, error: errorMessage } as VideoUploadResponse,
      { status: 500 }
    );
  }
} 