import { NextRequest } from 'next/server';
import { analyzeVideo } from '@/lib/vertex-ai/analyze';
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

    // Analyze the video
    const result = await analyzeVideo(body.gcsUri, body.adminSettings);

    return Response.json(
      { success: true, result } as VideoAnalysisResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Analysis error:', errorMessage);
    
    return Response.json(
      { success: false, error: 'Failed to analyze video. Please try again.' } as VideoAnalysisResponse,
      { status: 500 }
    );
  }
} 