"use server"

import { revalidatePath } from "next/cache"
import type { VideoAnalysisResult, AdminSettings } from "./types"
import { ADMIN_SETTINGS_KEY } from "./client-storage"

// In-memory cache for settings (only exists within a single server instance)
let cachedSettings: AdminSettings | null = null

// This is a mock function that simulates video analysis
// In a real app, you would upload the video to a service that performs AI analysis
export async function analyzeVideo(formData: FormData): Promise<{ id: string }> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Generate a random ID for the analysis
  const id = Math.random().toString(36).substring(2, 15)

  // In a real app, you would store the analysis results in a database
  // and return the ID to redirect the user to the results page

  return { id }
}

// This is a mock function that simulates fetching video analysis results
// In a real app, you would fetch the results from your database
export async function getVideoAnalysis(
  id: string, 
  decision = "pass", 
  explicitSettings?: AdminSettings
): Promise<VideoAnalysisResult | null> {
  // Simulate database lookup
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Use explicit settings if provided, otherwise fall back to stored settings
  let settings: AdminSettings;
  
  if (explicitSettings) {
    // Use the explicitly provided settings
    settings = explicitSettings;
    console.log("Using explicit admin settings:", settings);
  } else {
    // Fall back to stored settings
    settings = await getAdminSettings();
    console.log("Using stored admin settings:", settings);
  }

  // Generate categories based on admin settings
  const categoryMap: Record<string, { name: string; score: number; feedback: string }> = {
    product_relevance: {
      name: "Product Relevance",
      score: decision === "revision" ? 45 : 88,
      feedback:
        decision === "revision"
          ? "The video doesn't clearly show how the product works or its key benefits. The product is barely visible in some scenes."
          : "The video clearly showcases the product's key features and benefits. Great job highlighting the unique selling points.",
    },
    visual_quality: {
      name: "Visual Quality",
      score: decision === "revision" ? 52 : 82,
      feedback:
        decision === "revision"
          ? "Poor lighting makes it difficult to see the product details. Several scenes are too dark or blurry."
          : "Good lighting in most scenes with clear focus. Some sections could benefit from better framing.",
    },
    audio_quality: {
      name: "Audio Quality",
      score: decision === "revision" ? 38 : 75,
      feedback:
        decision === "revision"
          ? "Significant background noise and echo make it hard to understand the narration. Volume levels are inconsistent."
          : "Voice is clear but there is some background noise. Consider using a better microphone or recording in a quieter environment.",
    },
    content_engagement: {
      name: "Content Engagement",
      score: decision === "revision" ? 55 : 85,
      feedback:
        decision === "revision"
          ? "The content lacks a compelling story or hook. Viewers may lose interest within the first 30 seconds."
          : "Content is engaging and well-structured. Good use of visual aids to support your message.",
    },
    talking_head_presence: {
      name: "Talking Head Presence",
      score: decision === "revision" ? 40 : 78,
      feedback:
        decision === "revision"
          ? "The reviewer rarely appears on camera, reducing authenticity and personal connection with the audience."
          : "Good on-camera presence with the reviewer visible at key moments, creating a personal connection.",
    },
    product_visibility: {
      name: "Product Visibility",
      score: decision === "revision" ? 35 : 85,
      feedback:
        decision === "revision"
          ? "The product is often out of frame or poorly positioned, making it difficult to see key features and details."
          : "Excellent product visibility with clear shots of all important features and details.",
    },
    use_case_demonstration: {
      name: "Use Case Demonstration",
      score: decision === "revision" ? 42 : 80,
      feedback:
        decision === "revision"
          ? "The video lacks practical demonstrations of how the product works in real-life scenarios."
          : "Good demonstration of the product in practical use cases, effectively showing functionality and benefits.",
    },
    unboxing_first_impressions: {
      name: "Unboxing or First Impressions",
      score: decision === "revision" ? 50 : 75,
      feedback:
        decision === "revision"
          ? "The unboxing experience is rushed or missing, failing to capture authentic first impressions."
          : "The unboxing sequence effectively captures genuine reactions and highlights the packaging experience.",
    },
    brand_mention: {
      name: "Brand Mention",
      score: decision === "revision" ? 30 : 90,
      feedback:
        decision === "revision"
          ? "The brand name is rarely or never mentioned, missing opportunities for brand recognition."
          : "The brand name is clearly mentioned multiple times throughout the video, enhancing brand awareness.",
    },
    product_mention: {
      name: "Product Mention",
      score: decision === "revision" ? 45 : 85,
      feedback:
        decision === "revision"
          ? "The specific product name or model is not clearly stated, reducing searchability and clarity."
          : "The product name and model are clearly mentioned multiple times, improving searchability and clarity.",
    },
    reviewer_sentiment: {
      name: "Reviewer Sentiment",
      score: decision === "revision" ? 60 : 88,
      feedback:
        decision === "revision"
          ? "The reviewer's tone seems inauthentic or inconsistent, undermining credibility of the review."
          : "The reviewer expresses genuine enthusiasm and provides balanced opinions, enhancing credibility.",
    },
    call_to_action: {
      name: "Call to Action",
      score: decision === "revision" ? 42 : 68,
      feedback:
        decision === "revision"
          ? "The video lacks a clear call to action, leaving viewers unsure about next steps."
          : "The call to action is present but could be more compelling. Consider making it more prominent.",
    },
  }

  // Filter categories based on admin settings
  const selectedCategories = settings?.selectedCategories || ["visual_quality", "audio_quality", "content_engagement"]
  const categories = selectedCategories.map((id) => categoryMap[id] || {
    name: id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    score: decision === "revision" ? 45 : 75,
    feedback: "No specific feedback available for this category."
  })

  // Generate overall score based on the selected categories
  const calculateOverallScore = () => {
    if (!categories.length) return decision === "revision" ? 48 : 78;
    
    const totalScore = categories.reduce((sum, category) => sum + category.score, 0);
    return Math.round(totalScore / categories.length);
  }

  // Add product context to summary if available
  let summary = ""
  let productInfo = ""

  if (settings?.productDescription) {
    productInfo = settings.productDescription.length > 50 
      ? `${settings.productDescription.substring(0, 50)}...` 
      : settings.productDescription;
  }

  if (productInfo) {
    summary = decision === "revision"
      ? `For the product "${productInfo}", this video requires significant improvements. The product features are not clearly demonstrated, and the overall quality is below our standards.`
      : `For the product "${productInfo}", this video demonstrates good content quality with clear messaging. The product features are well-highlighted, and the visual elements effectively showcase its benefits.`
  } else {
    summary = decision === "revision"
      ? "This video requires significant improvements in several key areas. The overall quality does not meet our standards for product representation. Major issues include poor audio quality, inadequate lighting, and unclear product demonstration."
      : "This video demonstrates good content quality with clear messaging, but could benefit from improved lighting and audio clarity. The pacing is appropriate, and the visual elements are engaging."
  }

  const overallScore = calculateOverallScore();

  // Generate recommendations based on scores
  const generateRecommendations = () => {
    const baseRecommendations = decision === "revision"
      ? [
          "Re-record audio in a quiet environment with a quality microphone",
          "Improve lighting to ensure the product is clearly visible in all scenes",
          "Create a stronger opening that immediately showcases the product",
          "Include clear demonstrations of the product's key features",
          "Add a specific, compelling call to action at the end",
        ]
      : [
          "Improve lighting consistency throughout the video",
          "Reduce background noise by using a lapel microphone",
          "Add more visual aids for complex topics",
        ];

    // Add category-specific recommendations based on low scores
    const categoryRecommendations = categories
      .filter(cat => cat.score < 60)
      .map(cat => {
        switch(cat.name.toLowerCase().replace(/\s+/g, '_')) {
          case 'product_relevance':
            return "Increase focus on showcasing product benefits and features";
          case 'audio_quality':
            return "Use an external microphone to improve audio clarity";
          case 'visual_quality':
            return "Improve lighting and camera positioning for clearer visuals";
          case 'content_engagement':
            return "Create a more compelling storyline to maintain viewer interest";
          case 'product_visibility':
            return "Ensure the product is clearly visible in all scenes";
          case 'talking_head_presence':
            return "Increase on-camera presence to build viewer connection";
          default:
            return "";
        }
      })
      .filter(Boolean);

    return [...new Set([...baseRecommendations, ...categoryRecommendations])];
  };

  // Return data with settings-based customization
  return {
    id,
    overallScore,
    summary,
    videoLength: "2:34",
    analysisDate: new Date().toISOString(),
    categories,
    recommendations: generateRecommendations(),
    productPageUrl: settings?.productPageUrl || "",
    adminSettings: settings, // Include the admin settings for reference
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

