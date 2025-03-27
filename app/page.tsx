import type { Metadata } from "next"
import { VideoReviewForm } from "@/components/video-review-form"
import AdminSettingsButton from "@/components/admin-settings-button"

export const metadata: Metadata = {
  title: "Video Review Form",
  description: "Upload your video for AI-powered analysis and review",
}

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 md:px-6">
      <div className="w-full max-w-3xl">
        <VideoReviewForm />
        <AdminSettingsButton />
      </div>
    </div>
  )
}

