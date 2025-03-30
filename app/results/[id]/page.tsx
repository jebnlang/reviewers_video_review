import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import VideoAnalysisResults from "@/components/video-analysis-results"
import VideoRevisionRequest from "@/components/video-revision-request"
import AdminSettingsButton from "@/components/admin-settings-button"
import AnalysisLoading from "@/components/analysis-loading"
import { getVideoAnalysis } from "@/lib/actions"
import { urlParamsToSettings } from "@/lib/server-url-params"
import type { AdminSettings, VideoAnalysisResult, AnalysisStatus } from "@/lib/types"

export const metadata: Metadata = {
  title: "Video Analysis Results",
  description: "View your AI-powered video analysis results",
}

interface ResultsPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    decision?: string
    notes?: string
    categories?: string
    productUrl?: string
    productDesc?: string
  }>
}

// Type guard to check if result is a VideoAnalysisResult
function isVideoAnalysisResult(result: any): result is VideoAnalysisResult {
  return result && 'overallScore' in result;
}

export default async function ResultsPage({ params, searchParams }: ResultsPageProps) {
  // Await both params and searchParams
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ])

  // Extract and validate the ID
  const id = resolvedParams?.id
  if (!id) notFound()

  // Extract other parameters with defaults
  const decision = resolvedSearchParams?.decision || "pass"
  const revisionNotes = resolvedSearchParams?.notes || ""
  
  // Extract admin settings from URL parameters using the server-side utility
  const adminSettings = urlParamsToSettings(resolvedSearchParams)
  
  // In a real app, fetch the analysis results from your database
  const analysisResults = await getVideoAnalysis(id, decision, adminSettings)

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

        {!analysisResults || ('status' in analysisResults && analysisResults.status === 'processing') ? (
          <AnalysisLoading id={id} />
        ) : isVideoAnalysisResult(analysisResults) ? (
          decision === "revision" ? (
            <VideoRevisionRequest results={analysisResults} revisionNotes={decodeURIComponent(revisionNotes)} />
          ) : (
            <VideoAnalysisResults results={analysisResults} />
          )
        ) : (
          notFound()
        )}

        <AdminSettingsButton />
      </div>
    </div>
  )
}

