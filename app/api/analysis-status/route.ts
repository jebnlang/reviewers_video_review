import { NextRequest } from 'next/server';
import { getAnalysisState } from '@/lib/analysis-state';
import { getVideoAnalysis } from '@/lib/actions';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const id = request.nextUrl.searchParams.get('id');
    
    if (!id) {
      return Response.json(
        { error: 'No analysis ID provided' },
        { status: 400 }
      );
    }

    // First check the in-memory state
    const state = getAnalysisState(id);
    if (state) {
      if (state.status === 'error') {
        return Response.json({
          status: 'error',
          error: state.error
        });
      }
      
      if (state.status === 'completed' && state.result) {
        return Response.json({
          status: 'completed',
          results: state.result
        });
      }
      
      if (state.status === 'processing' || state.status === 'pending') {
        return Response.json({ status: 'processing' });
      }
    }

    // If no state found, check the filesystem as fallback
    const results = await getVideoAnalysis(id);
    
    if (!results) {
      return Response.json(
        { status: 'error', error: 'Analysis not found' },
        { status: 404 }
      );
    }

    if ('status' in results && results.status === 'processing') {
      return Response.json({ status: 'processing' });
    }

    return Response.json({
      status: 'completed',
      results
    });
  } catch (error) {
    console.error('Error checking analysis status:', error);
    return Response.json(
      { status: 'error', error: 'Failed to check analysis status' },
      { status: 500 }
    );
  }
} 