import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { FileValidation, VideoUploadOptions } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return "0 Bytes"
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export const DEFAULT_UPLOAD_OPTIONS: VideoUploadOptions = {
  maxSizeInBytes: 100 * 1024 * 1024, // 100MB
  allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  generatePreview: true,
};

export function validateVideoFile(file: File, options: VideoUploadOptions = DEFAULT_UPLOAD_OPTIONS): FileValidation {
  // Check if file exists
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  // Check file type
  if (!options.allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Please upload one of: ${options.allowedTypes
        .map((type) => type.split('/')[1].toUpperCase())
        .join(', ')}`,
    };
  }

  // Check file size
  if (file.size > options.maxSizeInBytes) {
    return {
      isValid: false,
      error: `File too large. Maximum size is ${formatBytes(options.maxSizeInBytes)}`,
    };
  }

  return { isValid: true };
}

export function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // When video metadata is loaded, set canvas size and seek to first frame
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = 0;
    };

    // When seeking is complete, draw the frame and get the data URL
    video.onseeked = () => {
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };

    // Handle errors
    video.onerror = () => {
      reject(new Error('Error loading video file'));
    };

    // Set video source
    video.src = URL.createObjectURL(file);
  });
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Error loading video metadata'));
    };

    video.src = URL.createObjectURL(file);
  });
}
