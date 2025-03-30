"use server"

import { revalidatePath } from "next/cache"
import type { VideoAnalysisResult, AdminSettings, AnalysisStatus } from "./types"
import { ADMIN_SETTINGS_KEY } from "./client-storage"
import fs from 'fs/promises';
import path from 'path';

// In-memory cache for settings (only exists within a single server instance)
let cachedSettings: AdminSettings | null = null

// This is a mock function that simulates video analysis
// In a real app, you would upload the video to a service that performs AI analysis
export async function analyzeVideo(formData: FormData): Promise<{ id: string }> {
  // Get the actual analysis ID from the response
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  // Return the analysis ID that will be used to fetch results
  return { id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
}

// Fetch video analysis results from the filesystem
export async function getVideoAnalysis(
  id: string, 
  decision = "pass", 
  explicitSettings?: AdminSettings
): Promise<VideoAnalysisResult | AnalysisStatus | null> {
  try {
    // Attempt to read the analysis results from the filesystem
    const analysisPath = path.join(process.cwd(), 'data', 'analysis', `${id}.json`);
    const analysisData = await fs.readFile(analysisPath, 'utf-8');
    const analysis = JSON.parse(analysisData);

    // Return the actual analysis results
    return {
      ...analysis,
      id,
      analysisDate: analysis.analysisDate || new Date().toISOString(),
      videoLength: analysis.videoLength || '00:00',
      adminSettings: explicitSettings || analysis.adminSettings,
      productPageUrl: (explicitSettings || analysis.adminSettings)?.productPageUrl,
    };
  } catch (error: any) {
    // If file not found, assume it's still processing
    if (error.code === 'ENOENT') {
      console.log(`Analysis file for ID ${id} not found. Assuming processing.`);
      return { status: 'processing' }; // Return processing status
    }
    // For other errors, log and return null
    console.error(`Failed to read analysis results for ID ${id}:`, error);
    return null;
  }
}

// Save admin settings
export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  // In a real app, you would save these settings to a database
  // For this demo, we'll simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Store settings in our in-memory cache for server-side use
  cachedSettings = settings

  // This is a server action, so we can't directly access localStorage.
  // We're relying on the client to handle storing in localStorage.
  // The client should call this function AND also update localStorage.

  console.log("Server: Saving settings:", settings)

  // Revalidate paths that might use these settings
  revalidatePath("/")
  revalidatePath("/results/[id]", "page")
  
  return
}

// Get admin settings
export async function getAdminSettings(): Promise<AdminSettings> {
  // This is a server action, so we can't directly access localStorage.
  // We'll return the in-memory cache first if available
  if (cachedSettings) {
    console.log("Server: Returning cached settings")
    return cachedSettings
  }

  // Default settings if none are set yet
  const defaultSettings = {
    productPageUrl: "",
    productDescription: "",
    selectedCategories: ["product_relevance", "visual_quality", "audio_quality", "content_engagement"],
  }

  // Initialize the cache with defaults if not set
  cachedSettings = defaultSettings

  console.log("Server: Returning default settings")
  return defaultSettings
}

