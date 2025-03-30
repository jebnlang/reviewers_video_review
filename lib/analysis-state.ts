import type { VideoAnalysisResult } from './types';

// In-memory store for analysis states
const analysisStates = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  result?: VideoAnalysisResult;
}>();

export function initializeAnalysis(id: string) {
  analysisStates.set(id, { status: 'pending' });
}

export function startAnalysis(id: string) {
  const state = analysisStates.get(id);
  if (state) {
    state.status = 'processing';
  }
}

export function completeAnalysis(id: string, result: VideoAnalysisResult) {
  analysisStates.set(id, {
    status: 'completed',
    result
  });
}

export function failAnalysis(id: string, error: string) {
  analysisStates.set(id, {
    status: 'error',
    error
  });
}

export function getAnalysisState(id: string) {
  return analysisStates.get(id);
}

// Clean up old analyses periodically (optional)
setInterval(() => {
  const now = Date.now();
  analysisStates.forEach((state, id) => {
    // Remove completed or error states older than 1 hour
    const timestamp = parseInt(id.split('_')[1]);
    if (!isNaN(timestamp) && now - timestamp > 3600000) {
      analysisStates.delete(id);
    }
  });
}, 3600000); // Run every hour 