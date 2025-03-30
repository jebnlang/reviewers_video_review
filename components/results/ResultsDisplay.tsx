"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import VideoAnalysisResults from "@/components/video-analysis-results";
import VideoRevisionRequest from "@/components/video-revision-request";
import AdminSettingsButton from "@/components/admin-settings-button";
import { getVideoAnalysis } from "@/lib/actions";
import type { VideoAnalysisResult, AnalysisStatus } from "@/lib/types";

// Utility function to check if data is in processing state
function isProcessing(data: VideoAnalysisResult | AnalysisStatus | null): data is AnalysisStatus {
  return data !== null && typeof data === 'object' && 'status' in data && data.status === 'processing';
}

interface ResultsDisplayProps {
  id: string;
  decision: "pass" | "revision";
  revisionNotes: string;
  initialAnalysisData: VideoAnalysisResult | AnalysisStatus | null;
}

export default function ResultsDisplay({ id, decision, revisionNotes, initialAnalysisData }: ResultsDisplayProps) {
  const [analysisData, setAnalysisData] = useState<VideoAnalysisResult | AnalysisStatus | null>(initialAnalysisData);
  // Start loading only if the initial data indicates processing is ongoing
  const [isLoading, setIsLoading] = useState(isProcessing(initialAnalysisData)); 
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only start polling if the initial data was in processing state and we have an ID
    if (!isProcessing(initialAnalysisData) || !id) {
      // If initial data is final or null, set loading to false if it wasn't already
      if (!isProcessing(initialAnalysisData)) {
           setIsLoading(false); 
      }
      // If ID is missing after initial check (shouldn't happen if passed from RSC), set error
      if (!id) {
          setError("Analysis ID missing.");
          setIsLoading(false);
      }
      return; // Don't poll if not initially processing or no ID
    }

    // Polling logic starts here only if initialAnalysisData.status === 'processing'
    let intervalId: NodeJS.Timeout | null = null;
    let attempts = 0;
    const maxAttempts = 10; // Poll for ~50 seconds max
    const pollInterval = 5000;

    const fetchData = async () => {
      try {
        const result = await getVideoAnalysis(id);
        
        if (result === null) {
          setError("Failed to fetch analysis results during polling.");
          setIsLoading(false);
          if (intervalId) clearInterval(intervalId);
        } else if (isProcessing(result)) {
          // Still processing, update data (optional, might cause layout shifts)
          // setAnalysisData(result); 
          setIsLoading(true); // Keep loading true
          attempts++;
          if (attempts >= maxAttempts) {
            setError("Analysis is taking longer than expected. Please check back later.");
            setIsLoading(false);
            if (intervalId) clearInterval(intervalId);
          }
        } else {
          // Processing finished or failed server-side
          setAnalysisData(result);
          setIsLoading(false);
          setError(null); // Clear any previous polling error
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Polling error:", err);
        setError("An unexpected error occurred while polling for results.");
        setIsLoading(false);
        if (intervalId) clearInterval(intervalId);
      }
    };

    // Start polling immediately since we know it's processing initially
    intervalId = setInterval(fetchData, pollInterval);

    // Cleanup interval on component unmount or if dependencies change
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // Depend on id and the initial processing state (though initial state won't change)
  }, [id, initialAnalysisData]); 

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl space-y-4">
         {/* Keep the Back button visible even during loading */}
         <div className="mb-6">
            <Button variant="outline" size="sm" asChild className="shadow-sm" disabled>
                <span className="flex items-center"> {/* Use span instead of Link when disabled */}
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Upload
                </span>
            </Button>
        </div>
         <Skeleton className="h-64 w-full" />
         <Skeleton className="h-32 w-full" />
         <p className="text-center text-muted-foreground">Analysis in progress, checking for results...</p>
         {/* Admin button might also be shown here if needed */}
         {/* <AdminSettingsButton /> */}
      </div>
    );
  }

  if (error) {
     return (
      <div className="w-full max-w-3xl text-center bg-destructive/10 p-6 rounded-lg">
         {/* Keep the Back button visible on error */}
         <div className="mb-6 flex justify-start">
             <Button variant="outline" size="sm" asChild className="shadow-sm">
                <Link href="/" className="flex items-center">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Upload
                </Link>
            </Button>
         </div>
         <p className="text-destructive">Error: {error}</p>
         {/* Optionally add a retry button here */}
      </div>
    );
  }

  // If loading is finished, but data is still null or somehow processing (e.g., polling stopped early), show notFound
  if (!analysisData || isProcessing(analysisData)) { 
      // Consider logging this state as it might indicate an issue
      console.warn("Render condition reached with invalid analysisData state:", analysisData);
      notFound(); 
  }

  // --- Final Render: Success State ---
  // The outer container and Back button are now handled by the Server Component parent
  return (
      <> 
        {decision === "revision" ? (
          <VideoRevisionRequest results={analysisData} revisionNotes={decodeURIComponent(revisionNotes)} />
        ) : (
          <VideoAnalysisResults results={analysisData} />
        )}

        <AdminSettingsButton />
      </>
  );
} 