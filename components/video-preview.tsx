"use client"

import { useRef, useEffect } from "react"

interface VideoPreviewProps {
  url: string
}

export default function VideoPreview({ url }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // When the URL changes, make sure to load the video
    if (videoRef.current && url) {
      videoRef.current.load()
    }
    
    return () => {
      // Clean up object URL when component unmounts
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    }
  }, [url])

  if (!url) {
    return <div className="relative bg-black aspect-video flex items-center justify-center">
      <p className="text-white">No video selected</p>
    </div>
  }

  return (
    <div className="relative bg-black aspect-video">
      <video 
        ref={videoRef} 
        src={url} 
        className="w-full h-full object-contain" 
        controls 
        preload="metadata"
        poster="/video-poster.png"
      />
    </div>
  )
}

