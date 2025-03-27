export interface VideoAnalysisCategory {
  name: string
  score: number
  feedback: string
}

export interface VideoAnalysisResult {
  id: string
  overallScore: number
  summary: string
  videoLength: string
  analysisDate: string
  categories: VideoAnalysisCategory[]
  recommendations: string[]
  productPageUrl?: string
  adminSettings?: AdminSettings
}

export interface AdminSettings {
  productPageUrl: string
  productDescription: string
  selectedCategories: string[]
}

export interface UploadProgress {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export interface VideoUploadResponse {
  success: boolean;
  gcsUri: string;
  uploadId: string;
  error?: string;
}

export interface VideoAnalysisRequest {
  gcsUri: string;
  adminSettings?: AdminSettings;
}

export interface VideoAnalysisResponse {
  success: boolean;
  result?: VideoAnalysisResult;
  error?: string;
}

export interface FileValidation {
  isValid: boolean;
  error?: string;
}

export interface UploadState extends UploadProgress {
  file?: File;
  previewUrl?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export interface VideoUploadOptions {
  maxSizeInBytes: number;
  allowedTypes: string[];
  generatePreview?: boolean;
}

