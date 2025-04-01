"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Upload, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import VideoPreview from "@/components/video-preview"
import { Progress } from "@/components/ui/progress"
import { formatBytes, validateVideoFile, DEFAULT_UPLOAD_OPTIONS, generateVideoThumbnail, getVideoDuration } from "@/lib/utils"
import clientStorage from "@/lib/client-storage"
import type { AdminSettings, UploadState } from "@/lib/types"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUploadContext } from '@/contexts/UploadContext'

export function VideoReviewForm() {
  const router = useRouter()
  const { lastFile, lastPreviewUrl, lastGcsUri, setLastUploadDetails } = useUploadContext();

  const [currentFile, setCurrentFile] = useState<File | undefined>(undefined);
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | undefined>(undefined);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null)
  const [gcsUri, setGcsUri] = useState<string | undefined>()
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    console.log("VideoReviewForm mounted, checking context...");
    let newPreviewUrl: string | undefined = undefined;
    if (lastFile) {
      console.log("Found file in context:", lastFile.name);
      setCurrentFile(lastFile);
      setGcsUri(lastGcsUri ?? undefined);
      setUploadState({
        status: lastGcsUri ? 'completed' : 'idle',
        progress: lastGcsUri ? 100 : 0,
      });
      try {
        newPreviewUrl = URL.createObjectURL(lastFile);
        setCurrentPreviewUrl(newPreviewUrl);
        console.log("Regenerated preview URL from context file:", newPreviewUrl);
      } catch (error) {
        console.error("Error creating object URL from context file:", error);
        setCurrentPreviewUrl(undefined);
      }
    } else {
      console.log("No file found in context.");
      setCurrentFile(undefined);
      setCurrentPreviewUrl(undefined);
      setGcsUri(undefined);
      setUploadState({ status: 'idle', progress: 0 });
    }
    const settings = clientStorage.getSettings()
    if (settings) {
      setAdminSettings(settings)
    }

    return () => {
      if (newPreviewUrl) {
        console.log("Revoking regenerated preview URL on effect cleanup:", newPreviewUrl);
        URL.revokeObjectURL(newPreviewUrl);
      }
    }
  }, []);

  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupEventSource()
    }
  }, [cleanupEventSource])

  const setupEventSource = useCallback((newUploadId: string) => {
    cleanupEventSource();
    console.log('Setting up SSE connection for uploadId:', newUploadId);
    const eventSource = new EventSource(`/api/upload/progress?uploadId=${newUploadId}`);
    eventSourceRef.current = eventSource;
    let retryCount = 0;
    const maxRetries = 3;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE progress update:', data);
        const { progress } = data;
        if (progress === 100) {
          setUploadState(prev => ({...prev, status: 'completed', progress: 100}));
          cleanupEventSource();
        } else if (progress === -1) {
          setUploadState(prev => ({...prev, status: 'error', progress: 0, error: 'Upload failed during transfer'}));
          cleanupEventSource();
        } else {
          setUploadState(prev => ({...prev, status: 'uploading', progress}));
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying SSE connection (attempt ${retryCount}/${maxRetries})...`);
        cleanupEventSource();
        setTimeout(() => { setupEventSource(newUploadId); }, 1000 * retryCount);
      } else {
        setUploadState(prev => ({...prev, status: 'error', progress: 0, error: 'Lost connection to upload progress'}));
        cleanupEventSource();
      }
    };
    eventSource.onopen = () => {
      console.log('SSE connection opened');
      retryCount = 0;
    };
  }, [cleanupEventSource]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected, clearing state and context');
      setCurrentFile(undefined);
      setCurrentPreviewUrl(undefined);
      setGcsUri(undefined);
      setUploadState({ status: 'idle', progress: 0 });
      setLastUploadDetails({ file: null, previewUrl: null, gcsUri: null });
      if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
      return;
    }

    console.log('File selected:', { name: file.name, type: file.type, size: file.size });

    setCurrentFile(file);
    setUploadState({ status: 'idle', progress: 0 });
    setGcsUri(undefined);
    setLastUploadDetails({ file: null, previewUrl: null, gcsUri: null });

    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    const newPreviewUrl = URL.createObjectURL(file);
    setCurrentPreviewUrl(newPreviewUrl);

    try {
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      if (!validTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Please upload ${validTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`);
      }
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is ${formatBytes(maxSize)}`);
      }

      setUploadState(prev => ({...prev, status: 'uploading', progress: 0}));
      const formData = new FormData();
      formData.append('file', file);

      console.log('Starting upload for file:', file.name);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', response.status);
      const responseData = await response.json();
      console.log('Upload response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Upload failed');
      }
      
      console.log('Received GCS URI:', responseData.gcsUri);
      setGcsUri(responseData.gcsUri);

      setUploadState(prev => ({...prev, status: 'completed', progress: 100 }));
      setLastUploadDetails({ file: file, previewUrl: newPreviewUrl, gcsUri: responseData.gcsUri });

    } catch (error) {
      console.error('File validation or upload error:', error);
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to upload video'
      }));
      setLastUploadDetails({ file: null, previewUrl: null, gcsUri: null });
      setCurrentFile(undefined);
      if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl);
      setCurrentPreviewUrl(undefined);
    }
  }, [currentPreviewUrl, setLastUploadDetails]);

  const handleAnalyze = async () => {
    if (!gcsUri || !currentFile) return 

    try {
      setIsAnalyzing(true)
      console.log('Starting analysis with GCS URI:', gcsUri);
      
      const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (currentFile && currentPreviewUrl && gcsUri) {
         setLastUploadDetails({ file: currentFile, previewUrl: currentPreviewUrl, gcsUri: gcsUri });
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ gcsUri, adminSettings, analysisId }),
      })

      if (response.status === 202) {
        const data = await response.json();
        console.log('Analysis started response:', data);
        console.log(`Redirecting to results for analysis ID: ${analysisId}`);
        router.push(`/results/${analysisId}`);
      } else {
        const data = await response.json();
        console.error('Analysis initiation failed:', response.status, data);
        throw new Error(data?.error || `Analysis initiation failed with status ${response.status}`);
      }

    } catch (error) {
      console.error('Analysis error:', error)
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start video analysis'
      }))
      setIsAnalyzing(false);
    }
  }

  useEffect(() => {
    const urlToClean = currentPreviewUrl;
    return () => {
      if (urlToClean) {
        console.log("Revoking currentPreviewUrl on unmount/change:", urlToClean);
        URL.revokeObjectURL(urlToClean);
      }
    }
  }, [currentPreviewUrl])

  return (
    <Card className="w-full max-w-lg mx-auto">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Video Review</h2>
          </div>
          <div className="text-xs text-white/80 bg-white/20 px-3 py-1 rounded-full">AI Powered</div>
        </div>
      </div>

      <CardHeader>
        <CardTitle className="text-center">Video Review Submission</CardTitle>
        <CardDescription className="text-center">Upload your video for AI-powered analysis</CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="space-y-6">
          {uploadState.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {uploadState.error}
            </div>
          )}

          <div className="border-2 border-dashed border-indigo-200 rounded-xl p-10 text-center hover:border-indigo-400 transition-colors duration-200">
            <input
              type="file"
              id="video-upload"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploadState.status === 'uploading' || isAnalyzing}
            />
            <label 
              htmlFor="video-upload" 
              className={`cursor-pointer block ${(uploadState.status === 'uploading' || isAnalyzing) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
            >
              {currentFile ? (
                <div className="space-y-2">
                  {currentPreviewUrl && <VideoPreview url={currentPreviewUrl} />}
                  <div className="flex items-center justify-center mt-2">
                    <Video className="h-8 w-8 text-indigo-600" />
                  </div>
                  <p className="text-sm font-medium">{currentFile.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(currentFile.size)}</p>
                  {uploadState.status === 'uploading' ? (
                    <p className="text-sm text-indigo-600">Uploading...</p>
                  ) : uploadState.status === 'completed' ? (
                    <p className="text-sm text-green-600">Upload complete!</p>
                  ) : uploadState.status === 'error' ? (
                    <p className="text-sm text-red-600">Upload failed. Click to retry.</p>
                  ) : (
                    <p className="text-sm text-gray-500">Click to change file</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-indigo-600" />
                  <p className="text-sm font-medium">Click to upload video</p>
                  <p className="text-xs text-gray-500">MP4, WEBM, MOV (max 100MB)</p>
                </div>
              )}
            </label>
          </div>

          {uploadState.status === 'uploading' && (
            <div className="space-y-2">
              <Progress value={uploadState.progress} className="h-2" />
              <p className="text-sm text-center text-gray-500">Uploading your video...</p>
            </div>
          )}

          {uploadState.status === 'completed' && gcsUri && (
            <Button
              onClick={handleAnalyze}
              className="w-full"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze Video
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

