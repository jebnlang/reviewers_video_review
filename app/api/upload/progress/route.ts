import { NextRequest } from 'next/server';
import { headers } from 'next/headers';

// Store upload progress for each upload ID
const uploadProgress = new Map<string, number>();

export function GET(request: NextRequest): Response {
  const uploadId = request.nextUrl.searchParams.get('uploadId');
  
  if (!uploadId) {
    return new Response('Upload ID is required', { status: 400 });
  }

  // Set up SSE headers
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'text/event-stream');
  responseHeaders.set('Cache-Control', 'no-cache');
  responseHeaders.set('Connection', 'keep-alive');
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET');
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Function to send progress updates
      const sendProgress = () => {
        try {
          const progress = uploadProgress.get(uploadId) ?? 0;
          const data = encoder.encode(`data: ${JSON.stringify({ progress })}\n\n`);
          controller.enqueue(data);

          // If upload is complete or failed, close the stream
          if (progress === 100 || progress === -1) {
            controller.close();
            uploadProgress.delete(uploadId);
          }
        } catch (error) {
          console.error('Error sending progress:', error);
          controller.error(error);
        }
      };

      // Send initial progress
      sendProgress();

      // Set up interval to check progress
      const interval = setInterval(() => {
        if (!uploadProgress.has(uploadId)) {
          clearInterval(interval);
          controller.close();
          return;
        }
        sendProgress();
      }, 1000);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        uploadProgress.delete(uploadId);
      });
    }
  });

  return new Response(stream, {
    headers: responseHeaders,
  });
}

// Helper function to update progress
export function updateProgress(uploadId: string, progress: number): void {
  if (!uploadId) {
    console.error('Attempted to update progress without uploadId');
    return;
  }
  console.log(`Updating progress for ${uploadId}: ${progress}%`);
  uploadProgress.set(uploadId, progress);
} 