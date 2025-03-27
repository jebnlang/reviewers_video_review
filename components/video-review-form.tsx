"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2, Video, ArrowRight } from "lucide-react"
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
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load admin settings from localStorage on component mount
  useEffect(() => {
    const settings = clientStorage.getSettings()
    if (settings) {
      setAdminSettings(settings)
    }
  }, [])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setSelectedFile(file);
      setUploadState({
        status: 'idle',
        progress: 0,
        file,
        previewUrl,
        fileName: file.name,
        fileSize: file.size,
      });
    }
  }, []);

  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return

    try {
      setUploadState(prev => ({
        ...prev,
        status: 'uploading',
        progress: 0,
        error: undefined
      }))

      // Create form data
      const formData = new FormData()
      formData.append('file', selectedFile)

      // Upload file
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      const { uploadId } = await uploadResponse.json()
      
      // Clean up any existing event source
      cleanupEventSource()

      // Set up SSE for progress updates
      const eventSource = new EventSource(`/api/upload/progress?uploadId=${uploadId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        const { progress } = JSON.parse(event.data)
        if (progress === 100) {
          setUploadState({ status: 'completed', progress: 100 })
          cleanupEventSource()
        } else if (progress === -1) {
          setUploadState({ status: 'error', progress: 0 })
          cleanupEventSource()
        } else {
          setUploadState({ status: 'uploading', progress })
        }
      }

      eventSource.onerror = () => {
        setUploadState({ status: 'error', progress: 0 })
        cleanupEventSource()
      }

      // Start analysis
      setIsAnalyzing(true)
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gcsUri: uploadState.previewUrl,
          adminSettings
        })
      })

      if (!analysisResponse.ok) {
        throw new Error('Analysis failed')
      }

      const analysisResult = await analysisResponse.json()
      
      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Analysis failed')
      }

      // Show decision screen
      setIsAnalyzing(false)
      setShowDecision(true)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }))
      setIsAnalyzing(false)
      cleanupEventSource()
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {uploadState.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center justify-between">
              <span>{uploadState.error}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                className="hover:bg-destructive/20"
              >
                Retry
              </Button>
            </div>
          )}
          
          {!uploadState.previewUrl ? (
            <div className="border-2 border-dashed border-indigo-200 rounded-xl p-10 text-center cursor-pointer hover:bg-indigo-50/50 transition-all duration-300 group">
              <input
                type="file"
                id="video-upload"
                accept={DEFAULT_UPLOAD_OPTIONS.allowedTypes.join(',')}
                onChange={handleFileChange}
                className="hidden"
                disabled={['uploading', 'processing'].includes(uploadState.status) || isAnalyzing}
              />
              <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors duration-300">
                  <Upload className="h-8 w-8 text-indigo-600" />
                </div>
                <p className="text-lg font-medium mb-1 text-indigo-700">Click to upload video</p>
                <p className="text-sm text-muted-foreground">
                  {DEFAULT_UPLOAD_OPTIONS.allowedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ')} (max {formatBytes(DEFAULT_UPLOAD_OPTIONS.maxSizeInBytes)})
                </p>
              </label>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl overflow-hidden border border-indigo-100 shadow-sm">
              <VideoPreview url={uploadState.previewUrl} />
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px] md:max-w-[300px]">
                    {selectedFile?.name}
                  </p>
                  {selectedFile?.size && (
                    <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (uploadState.previewUrl) {
                      URL.revokeObjectURL(uploadState.previewUrl)
                    }
                    setSelectedFile(undefined)
                    setUploadState({
                      status: 'idle',
                      progress: 0,
                    })
                  }}
                  disabled={['uploading', 'processing'].includes(uploadState.status) || isAnalyzing}
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          {uploadState.status !== 'idle' && (
            <div className="space-y-2">
              <Progress value={uploadState.progress} />
              <p className="text-sm text-gray-500">
                {uploadState.status === 'uploading' && 'Uploading...'}
                {uploadState.status === 'processing' && 'Processing...'}
                {uploadState.status === 'completed' && 'Upload complete!'}
                {uploadState.status === 'error' && 'Upload failed. Please try again.'}
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex items-center justify-center space-x-2 text-indigo-700">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">Analyzing your video...</span>
              </div>
            </div>
          )}

          {selectedFile && !isAnalyzing && !['uploading', 'processing'].includes(uploadState.status) && (
            <Button
              type="submit"
              className="w-full"
              disabled={['uploading', 'processing'].includes(uploadState.status) || isAnalyzing}
            >
              {selectedFile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upload Video
                </>
              ) : isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Start Analysis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

