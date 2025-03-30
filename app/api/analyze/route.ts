import { NextRequest } from 'next/server';
import { analyzeVideo } from '@/lib/vertex-ai/analyze';
import { initializeAnalysis, startAnalysis, completeAnalysis, failAnalysis } from '@/lib/analysis-state';
import type { VideoAnalysisRequest, VideoAnalysisResponse } from '@/lib/types';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as VideoAnalysisRequest;
    
    if (!body.gcsUri) {
      return Response.json(
        { success: false, error: 'No video URI provided' } as VideoAnalysisResponse,
        { status: 400 }
      );
    }

    // Use the analysis ID from the request
    const analysisId = body.analysisId;
    if (!analysisId) {
      return Response.json(
        { success: false, error: 'No analysis ID provided' } as VideoAnalysisResponse,
        { status: 400 }
      );
    }

    // Initialize analysis state
    initializeAnalysis(analysisId);

    // Trigger analysis asynchronously with the provided ID
    (async () => {
      try {
        startAnalysis(analysisId);
        const analysisResult = await analyzeVideo(body.gcsUri, body.adminSettings, analysisId);
        completeAnalysis(analysisId, analysisResult);
        console.log(`Background analysis completed for ID: ${analysisResult.id}.`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        failAnalysis(analysisId, errorMessage);
        console.error(`Background analysis FAILED for ID ${analysisId}:`, errorMessage);
      }
    })();

    // Respond immediately indicating analysis has started
    return Response.json(
      {
        success: true,
        message: 'Analysis started successfully.',
        analysisId: analysisId
      } as Partial<VideoAnalysisResponse> & { analysisId: string },
      { status: 202 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error initiating analysis:', errorMessage);
    
    return Response.json(
      { success: false, error: 'Failed to initiate video analysis.' } as VideoAnalysisResponse,
      { status: 500 }
    );
  }
} 