"use client"

import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="container flex h-[80vh] flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-xl font-medium">Analyzing Results...</h2>
        <p className="text-muted-foreground">Our AI is processing your video analysis results.</p>
      </div>
    </div>
  )
} 