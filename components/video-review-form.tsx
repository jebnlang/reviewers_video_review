"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Upload, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import VideoPreview from "@/components/video-preview"
import { Progress } from "@/components/ui/progress"
import VideoDecisionScreen from "@/components/video-decision-screen"
import { formatBytes, validateVideoFile, DEFAULT_UPLOAD_OPTIONS, generateVideoThumbnail, getVideoDuration } from "@/lib/utils"
import clientStorage from "@/lib/client-storage"
import type { AdminSettings, UploadState } from "@/lib/types"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function VideoReviewForm() {
  const router = useRouter()
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showDecision, setShowDecision] = useState(false)
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | undefined>()
  const [uploadId, setUploadId] = useState<string | undefined>()
  const [gcsUri, setGcsUri] = useState<string | undefined>()
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load admin settings from localStorage on component mount
  useEffect(() => {
    const settings = clientStorage.getSettings()
    if (settings) {
      setAdminSettings(settings)
    }
  }, [])

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
    // Clean up any existing event source
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
          setUploadState(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
          }));
          cleanupEventSource();
        } else if (progress === -1) {
          setUploadState(prev => ({
            ...prev,
            status: 'error',
            progress: 0,
            error: 'Upload failed during transfer'
          }));
          cleanupEventSource();
        } else {
          setUploadState(prev => ({
            ...prev,
            status: 'uploading',
            progress,
          }));
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
        
        // Close the current connection
        cleanupEventSource();
        
        // Wait a bit before retrying
        setTimeout(() => {
          setupEventSource(newUploadId);
        }, 1000 * retryCount); // Exponential backoff
      } else {
        setUploadState(prev => ({
          ...prev,
          status: 'error',
          progress: 0,
          error: 'Lost connection to upload progress'
        }));
        cleanupEventSource();
      }
    };

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      retryCount = 0; // Reset retry count on successful connection
    };
  }, [cleanupEventSource]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    setSelectedFile(file);
    setUploadState({ status: 'idle', progress: 0 });

    try {
      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      if (!validTypes.includes(file.type)) {
        console.error('Invalid file type:', file.type);
        setUploadState(prev => ({
          ...prev,
          status: 'error',
          progress: 0,
          error: `Invalid file type. Please upload ${validTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`
        }));
        return;
      }

      // Validate file size (100MB max)
      const maxSize = 100 * 1024 * 1024; // 100MB in bytes
      if (file.size > maxSize) {
        console.error('File too large:', formatBytes(file.size));
        setUploadState(prev => ({
          ...prev,
          status: 'error',
          progress: 0,
          error: `File too large. Maximum size is ${formatBytes(maxSize)}`
        }));
        return;
      }

      setUploadState(prev => ({
        ...prev,
        status: 'uploading',
        progress: 0,
      }));

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

      setUploadState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
      }));

      setGcsUri(responseData.gcsUri);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to upload video'
      }));
    }
  }, []);

  const handleAnalyze = async () => {
    if (!gcsUri) return

    try {
      setIsAnalyzing(true)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          gcsUri,
          adminSettings // Include admin settings if available
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      // If we have a result, redirect to the results page
      if (data.result) {
        const { id, overallScore } = data.result
        // Redirect to results page with the analysis ID
        router.push(`/results/${id}`)
      }

    } catch (error) {
      console.error('Analysis error:', error)
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to analyze video'
      }))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCancelDecision = useCallback(() => {
    setShowDecision(false)
    setUploadState({
      status: 'idle',
      progress: 0,
    })
  }, [])

  const handleRetry = useCallback(() => {
    if (selectedFile) {
      setSelectedFile(selectedFile)
      setUploadState({
        status: 'idle',
        progress: 0,
        file: selectedFile,
        previewUrl: uploadState.previewUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      })
    }
  }, [selectedFile, uploadState.previewUrl])

  // Clean up preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (uploadState.previewUrl) {
        URL.revokeObjectURL(uploadState.previewUrl)
      }
    }
  }, [uploadState.previewUrl])

  // Prepare for decision screen
  if (showDecision && uploadState.previewUrl && selectedFile) {
    // Load latest settings before showing decision screen
    const latestSettings = clientStorage.getSettings()
    
    return (
      <VideoDecisionScreen 
        videoUrl={uploadState.previewUrl}
        videoName={selectedFile.name}
        onCancel={handleCancelDecision}
        adminSettings={latestSettings}
      />
    )
  }

  return (
    <Card className="w-full overflow-hidden border-2 shadow-lg">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Video Review</h2>
          </div>
          <div className="text-xs text-white/80 bg-white/20 px-3 py-1 rounded-full">AI Powered</div>
        </div>
      </div>

      <CardHeader className="pb-0">
        <CardTitle className="text-center text-2xl">Share Your Video</CardTitle>
        <CardDescription className="text-center">
          We'll analyze your content and provide detailed feedback
        </CardDescription>
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
              disabled={uploadState.status === 'uploading'}
            />
            <label 
              htmlFor="video-upload" 
              className={`cursor-pointer block ${uploadState.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center">
                    <Video className="h-8 w-8 text-indigo-600" />
                  </div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(selectedFile.size)}</p>
                  {uploadState.status === 'uploading' ? (
                    <p className="text-sm text-indigo-600">Uploading...</p>
                  ) : uploadState.status === 'completed' ? (
                    <p className="text-sm text-green-600">Upload complete!</p>
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

          {uploadState.status === 'completed' && (
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

