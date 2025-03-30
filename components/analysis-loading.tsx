'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AnalysisLoadingProps {
  id: string;
}

export default function AnalysisLoading({ id }: AnalysisLoadingProps) {
  const [dots, setDots] = useState('.');
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 60; // 30 seconds (500ms * 60)

  useEffect(() => {
    // Animate loading dots
    const dotsInterval = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.');
    }, 500);

    // Poll for results
    const checkResults = async () => {
      try {
        const response = await fetch(`/api/analysis-status?id=${id}`);
        const data = await response.json();
        
        if (data.status === 'completed') {
          // Reload the page when analysis is complete
          window.location.reload();
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking analysis status:', error);
        return false;
      }
    };

    const pollInterval = setInterval(async () => {
      setAttempts(a => {
        if (a >= MAX_ATTEMPTS) {
          clearInterval(pollInterval);
          clearInterval(dotsInterval);
          return a;
        }
        return a + 1;
      });

      const completed = await checkResults();
      if (completed) {
        clearInterval(pollInterval);
        clearInterval(dotsInterval);
      }
    }, 500);

    // Initial check
    checkResults();

    return () => {
      clearInterval(dotsInterval);
      clearInterval(pollInterval);
    };
  }, [id]);

  if (attempts >= MAX_ATTEMPTS) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">Analysis is taking longer than expected.</p>
        <p className="text-sm text-gray-600">Please refresh the page to check the status.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-lg">
        Processing video analysis{dots}
      </p>
      <p className="text-sm text-gray-600">
        This may take a few moments
      </p>
    </div>
  );
} 