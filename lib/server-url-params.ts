import type { AdminSettings } from "./types"

/**
 * Parse URL parameters into admin settings on the server side
 */
export function urlParamsToSettings(
  searchParams: { [key: string]: string | string[] | undefined }
): AdminSettings {
  // Default categories if none are provided
  const defaultCategories = ["product_relevance", "visual_quality", "audio_quality", "content_engagement"];
  
  // Extract admin settings from URL parameters
  const categories = typeof searchParams.categories === 'string' 
    ? searchParams.categories.split(',') 
    : defaultCategories;
    
  const productUrl = typeof searchParams.productUrl === 'string' ? searchParams.productUrl : "";
  
  const productDesc = typeof searchParams.productDesc === 'string' 
    ? decodeURIComponent(searchParams.productDesc) 
    : "";
  
  // Return constructed settings
  return {
    selectedCategories: categories,
    productPageUrl: productUrl,
    productDescription: productDesc
  };
} 