import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import VideoAnalysisResults from "@/components/video-analysis-results"
import VideoRevisionRequest from "@/components/video-revision-request"
import AdminSettingsButton from "@/components/admin-settings-button"
import { getVideoAnalysis } from "@/lib/actions"
import { urlParamsToSettings } from "@/lib/server-url-params"
import type { AdminSettings } from "@/lib/types"

export const metadata: Metadata = {
  title: "Video Analysis Results",
  description: "View your AI-powered video analysis results",
}

interface ResultsPageProps {
  params: {
    id: string
  }
  searchParams: {
    decision?: string
    notes?: string
    categories?: string
    productUrl?: string
    productDesc?: string
  }
}

export default async function ResultsPage({ params, searchParams }: ResultsPageProps) {
  // Extract and validate the ID
  const id = params?.id
  if (!id) notFound()

  // Extract other parameters with defaults
  const decision = searchParams?.decision || "pass"
  const revisionNotes = searchParams?.notes || ""
  
  // Extract admin settings from URL parameters using the server-side utility
  const adminSettings = urlParamsToSettings(searchParams)
  
  // In a real app, fetch the analysis results from your database
  const analysisResults = await getVideoAnalysis(id, decision, adminSettings)

  if (!analysisResults) {
    notFound()
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 md:px-6">
      <div className="w-full max-w-3xl">
        <div className="mb-6">
          <Button variant="outline" size="sm" asChild className="shadow-sm">
            <Link href="/" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Upload
            </Link>
          </Button>
        </div>

        {decision === "revision" ? (
          <VideoRevisionRequest results={analysisResults} revisionNotes={decodeURIComponent(revisionNotes)} />
        ) : (
          <VideoAnalysisResults results={analysisResults} />
        )}

        <AdminSettingsButton />
      </div>
    </div>
  )
}

