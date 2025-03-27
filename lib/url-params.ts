"use client"

import type { AdminSettings } from "./types"

/**
 * Convert admin settings to URL parameters
 */
export function settingsToUrlParams(settings: AdminSettings | null): URLSearchParams {
  const params = new URLSearchParams();
  
  if (!settings) return params;
  
  // Add selected categories
  if (settings.selectedCategories && settings.selectedCategories.length > 0) {
    params.append('categories', settings.selectedCategories.join(','));
  }
  
  // Add product URL if available
  if (settings.productPageUrl) {
    params.append('productUrl', settings.productPageUrl);
  }
  
  // Add product description if available
  if (settings.productDescription) {
    // Truncate description to avoid URL length issues
    params.append('productDesc', encodeURIComponent(settings.productDescription.substring(0, 500)));
  }
  
  return params;
}

/**
 * Parse URL parameters into admin settings
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