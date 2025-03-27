import { NextRequest } from 'next/server';
import { uploadVideo } from '@/lib/cloud-storage/upload';
import { updateProgress } from './progress/route';
import { v4 as uuidv4 } from 'uuid';
import type { UploadProgress, VideoUploadResponse } from '@/lib/types';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Get the file from form data
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

    const uploadId = uuidv4();

    // Upload to Cloud Storage
    const gcsUri = await uploadVideo(file, (progress: UploadProgress) => {
      if (progress.status === 'error') {
        updateProgress(uploadId, -1);
      } else {
        updateProgress(uploadId, progress.progress);
      }
    });

    // Return the GCS URI
    return Response.json(
      { success: true, gcsUri, uploadId } as VideoUploadResponse,
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