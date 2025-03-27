"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2, Video, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import VideoPreview from "@/components/video-preview"
import { Progress } from "@/components/ui/progress"
import VideoDecisionScreen from "@/components/video-decision-screen"
import { formatBytes } from "@/lib/utils"
import clientStorage from "@/lib/client-storage"
import type { AdminSettings } from "@/lib/types"

export default function VideoReviewForm() {
  const router = useRouter()
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showDecision, setShowDecision] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null)

  // Load admin settings from localStorage on component mount
  useEffect(() => {
    const settings = clientStorage.getSettings()
    if (settings) {
      setAdminSettings(settings)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Clear previous errors
    setError(null)

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid video file (MP4, WebM, or MOV)')
      return
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      setError('File is too large. Maximum size is 100MB')
      return
    }

    // If we had a previous video URL, revoke it to prevent memory leaks
    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl)
    }

    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoPreviewUrl(url)
    
    // Reset upload state
    setUploadProgress(0)
  }, [videoPreviewUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoFile) return

    try {
      setIsUploading(true)
      setError(null)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval)
            return 95
          }
          return prev + 5
        })
      }, 300)

      // Simulate upload completion
      setTimeout(() => {
        clearInterval(progressInterval)
        setUploadProgress(100)
        setIsUploading(false)
        setIsAnalyzing(true)

        // Simulate AI analysis
        setTimeout(() => {
          setIsAnalyzing(false)
          // Show decision screen instead of navigating directly
          setShowDecision(true)
        }, 3000)
      }, 3000)
    } catch (error) {
      console.error("Upload failed:", error)
      setError("Failed to upload the video. Please try again.")
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleCancelDecision = () => {
    setShowDecision(false)
  }

  // Prepare for decision screen - pass adminSettings as a prop
  if (showDecision && videoPreviewUrl && videoFile) {
    // Load latest settings before showing decision screen
    const latestSettings = clientStorage.getSettings()
    
    return (
      <VideoDecisionScreen 
        videoUrl={videoPreviewUrl} 
        videoName={videoFile.name} 
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
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
          
          {!videoPreviewUrl ? (
            <div className="border-2 border-dashed border-indigo-200 rounded-xl p-10 text-center cursor-pointer hover:bg-indigo-50/50 transition-all duration-300 group">
              <input type="file" id="video-upload" accept="video/mp4,video/webm,video/quicktime" onChange={handleFileChange} className="hidden" />
              <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors duration-300">
                  <Upload className="h-8 w-8 text-indigo-600" />
                </div>
                <p className="text-lg font-medium mb-1 text-indigo-700">Click to upload video</p>
                <p className="text-sm text-muted-foreground">MP4, MOV, or WebM (max 100MB)</p>
              </label>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl overflow-hidden border border-indigo-100 shadow-sm">
              <VideoPreview url={videoPreviewUrl} />
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px] md:max-w-[300px]">{videoFile?.name}</p>
                  {videoFile && (
                    <p className="text-xs text-muted-foreground">{formatBytes(videoFile.size)}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (videoPreviewUrl) {
                      URL.revokeObjectURL(videoPreviewUrl)
                    }
                    setVideoFile(null)
                    setVideoPreviewUrl(null)
                  }}
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-indigo-700">Uploading video...</span>
                <span className="font-bold">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2 bg-indigo-100" />
            </div>
          )}

          {isAnalyzing && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-indigo-700">AI analyzing content...</span>
                <span className="font-bold animate-pulse">Processing</span>
              </div>
              <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 animate-pulse w-full opacity-50"></div>
              </div>
            </div>
          )}
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-4 pb-6">
        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all duration-300"
          disabled={!videoFile || isUploading || isAnalyzing}
          onClick={handleSubmit}
        >
          {isUploading ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </span>
          ) : isAnalyzing ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Video...
            </span>
          ) : (
            <span className="flex items-center">
              Submit for Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By submitting, you agree to our Terms of Service and Privacy Policy
        </p>
      </CardFooter>
    </Card>
  )
}

