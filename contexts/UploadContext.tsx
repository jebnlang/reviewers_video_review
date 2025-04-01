'use client'; // Required for context and hooks

import type React from 'react';
import { createContext, useState, useMemo, useCallback, useContext } from 'react';

// Define the shape of the context state
interface UploadContextState {
  lastFile: File | null;
  lastPreviewUrl: string | null;
  lastGcsUri: string | null; // Store GCS URI to confirm it's the analyzed file
  setLastUploadDetails: (details: { file: File | null; previewUrl: string | null; gcsUri: string | null }) => void;
}

// Create the context with a default value
const UploadContext = createContext<UploadContextState | undefined>(undefined);

// Create the Provider component
interface UploadProviderProps {
  children: React.ReactNode;
}

export function UploadProvider({ children }: UploadProviderProps) {
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [lastGcsUri, setLastGcsUri] = useState<string | null>(null);

  // Define the function to update the state
  // Use useCallback to prevent unnecessary re-renders of consumers
  const setLastUploadDetails = useCallback((details: { file: File | null; previewUrl: string | null; gcsUri: string | null }) => {
    setLastFile(details.file);
    setLastPreviewUrl(details.previewUrl);
    setLastGcsUri(details.gcsUri);
    console.log('UploadContext updated:', { 
      fileName: details.file?.name, 
      previewUrl: !!details.previewUrl,
      gcsUri: details.gcsUri 
    });
  }, []);

  // Memoize the context value to prevent re-renders unless state changes
  const value = useMemo(() => ({
    lastFile,
    lastPreviewUrl,
    lastGcsUri,
    setLastUploadDetails,
  }), [lastFile, lastPreviewUrl, lastGcsUri, setLastUploadDetails]);

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
}

// Create a custom hook for easy consumption
export function useUploadContext() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUploadContext must be used within an UploadProvider');
  }
  return context;
} 