import { videoIntelligenceClient, model } from './client';
import type { VideoAnalysisResult, AdminSettings, VideoAnalysisCategory } from '../types';
import fs from 'fs/promises';
import path from 'path';
import { protos } from '@google-cloud/video-intelligence';

const { Feature } = protos.google.cloud.videointelligence.v1;
type VideoFeature = protos.google.cloud.videointelligence.v1.Feature;
type IAnnotateVideoRequest = protos.google.cloud.videointelligence.v1.IAnnotateVideoRequest;

// Type definitions for the Video Intelligence API responses
interface EnhancedLabelAnnotation extends protos.google.cloud.videointelligence.v1.ILabelAnnotation {
  confidence?: number;
}

interface EnhancedVideoAnnotationResults extends protos.google.cloud.videointelligence.v1.IVideoAnnotationResults {
  labelAnnotations?: EnhancedLabelAnnotation[];
  shotLabelAnnotations?: EnhancedLabelAnnotation[];
  frameLabelAnnotations?: EnhancedLabelAnnotation[];
}

type SpeechTranscription = protos.google.cloud.videointelligence.v1.ISpeechTranscription;
type ExplicitContentFrame = protos.google.cloud.videointelligence.v1.IExplicitContentFrame;

export async function analyzeVideo(
  gcsUri: string,
  adminSettings?: AdminSettings,
  analysisId?: string
): Promise<VideoAnalysisResult> {
  try {
    console.log('=== Starting Video Analysis Process ===');
    console.log('Input Parameters:', {
      gcsUri,
      analysisId,
      adminSettings: {
        ...adminSettings,
        selectedCategories: adminSettings?.selectedCategories || [],
        productPageUrl: adminSettings?.productPageUrl || 'Not provided'
      }
    });

    // Define features to detect based on selected categories
    const features = determineFeatures(adminSettings);
    console.log('Selected Video Intelligence Features:', {
      features: features.map(f => Feature[f]),
      reason: 'Based on admin settings categories'
    });
    
    // Configure the request to Video Intelligence API
    const request: IAnnotateVideoRequest = {
      inputUri: gcsUri,
      features: features,
      videoContext: {
        speechTranscriptionConfig: {
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
        },
      },
    };
    
    console.log('Video Intelligence API Request Configuration:', {
      request,
      timestamp: new Date().toISOString()
    });
    
    // Make the API call - this returns a long-running operation
    console.log('Initiating Video Intelligence API call...');
    const operation = await videoIntelligenceClient.annotateVideo(request);
    console.log('Received operation response:', {
      operationName: operation[0].name,
      metadata: operation[0].metadata,
      timestamp: new Date().toISOString()
    });
    
    // Wait for the operation to complete
    console.log('Waiting for Video Intelligence operation to complete...');
    const [operationResult] = await operation[0].promise();
    console.log('Video Intelligence operation completed:', {
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      resultSize: JSON.stringify(operationResult).length + ' bytes'
    });
    
    // Get the first (and typically only) result
    const annotationResults = operationResult.annotationResults?.[0] as EnhancedVideoAnnotationResults;
    if (!annotationResults) {
      throw new Error('No annotation results returned from Video Intelligence API');
    }
    
    console.log('Raw Video Intelligence Results:', {
      labelAnnotationsCount: annotationResults.labelAnnotations?.length || 0,
      shotLabelAnnotationsCount: annotationResults.shotLabelAnnotations?.length || 0,
      frameLabelAnnotationsCount: annotationResults.frameLabelAnnotations?.length || 0,
      speechTranscriptionsCount: annotationResults.speechTranscriptions?.length || 0,
      shotAnnotationsCount: annotationResults.shotAnnotations?.length || 0,
      explicitAnnotationFrames: annotationResults.explicitAnnotation?.frames?.length || 0
    });
    
    // Process the results and convert to our application format
    console.log('Processing Video Intelligence results into application format...');
    const analysis = processVideoIntelligenceResults(annotationResults, gcsUri, adminSettings, analysisId);
    console.log('Initial analysis results:', {
      id: analysis.id,
      overallScore: analysis.overallScore,
      categoriesCount: analysis.categories.length,
      recommendationsCount: analysis.recommendations.length,
      videoLength: analysis.videoLength
    });
    
    // Enhance the analysis with AI-generated observations
    console.log('Starting AI enhancement process...');
    await enhanceAnalysisWithAI(analysis, annotationResults, gcsUri, adminSettings);
    console.log('AI enhancement completed:', {
      finalCategoriesCount: analysis.categories.length,
      finalRecommendationsCount: analysis.recommendations.length,
      hasAISummary: !!analysis.summary
    });

    // Save the analysis results to a file
    const analysisDir = path.join(process.cwd(), 'data', 'analysis');
    await fs.mkdir(analysisDir, { recursive: true });
    const analysisPath = path.join(analysisDir, `${analysis.id}.json`);
    await fs.writeFile(
      analysisPath,
      JSON.stringify(analysis, null, 2)
    );
    console.log('Analysis saved to file:', {
      path: analysisPath,
      sizeBytes: JSON.stringify(analysis).length
    });

    console.log('=== Video Analysis Process Completed Successfully ===');
    return analysis;
  } catch (error: unknown) {
    console.error('=== Video Analysis Process Failed ===');
    console.error('Error Details:', {
      type: error instanceof Error ? error.constructor.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Failed Analysis Parameters:', {
      gcsUri,
      analysisId,
      adminSettingsProvided: !!adminSettings
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to analyze video: ${errorMessage}`);
  }
}

// Determine which Video Intelligence features to use based on admin settings
function determineFeatures(
  adminSettings?: AdminSettings
): VideoFeature[] {
  const features = [
    Feature.LABEL_DETECTION,
    Feature.SHOT_CHANGE_DETECTION,
  ];
  
  if (adminSettings?.selectedCategories?.some(cat => 
    cat.includes('audio') || cat.includes('voice') || cat.includes('speech')
  )) {
    features.push(Feature.SPEECH_TRANSCRIPTION);
  }
  
  if (adminSettings?.selectedCategories?.some(cat => 
    cat.includes('content_appropriateness') || cat.includes('explicit')
  )) {
    features.push(Feature.EXPLICIT_CONTENT_DETECTION);
  }
  
  return features;
}

// Process the Video Intelligence results into our application format
function processVideoIntelligenceResults(
  results: EnhancedVideoAnnotationResults,
  gcsUri: string,
  adminSettings?: AdminSettings,
  analysisId?: string
): VideoAnalysisResult {
  // Use provided ID or generate a new one
  const id = analysisId || `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Extract and process labels
  const labels = results.labelAnnotations || [];
  const shotLabels = results.shotLabelAnnotations || [];
  const frameLabels = results.frameLabelAnnotations || [];
  
  // Extract speech transcription
  const speechTranscriptions = results.speechTranscriptions || [];
  
  // Process shot changes for video pacing analysis
  const shotChanges = results.shotAnnotations || [];
  
  // Process explicit content if available
  const explicitAnnotations = results.explicitAnnotation?.frames || [];
  
  // Calculate scores based on the extracted data
  const visualQualityScore = calculateVisualQualityScore(labels, shotLabels, frameLabels);
  const audioQualityScore = calculateAudioQualityScore(speechTranscriptions);
  const contentEffectivenessScore = calculateContentEffectivenessScore(
    labels, 
    shotLabels, 
    shotChanges, 
    speechTranscriptions
  );
  
  // Overall score is a weighted average of individual scores
  const overallScore = Math.round(
    (visualQualityScore * 0.4) + 
    (audioQualityScore * 0.3) + 
    (contentEffectivenessScore * 0.3)
  );
  
  // Generate categories based on the admin settings
  const categories = generateCategories(
    adminSettings?.selectedCategories || [],
    labels,
    shotLabels,
    frameLabels,
    speechTranscriptions,
    shotChanges,
    explicitAnnotations
  );
  
  // Generate recommendations based on scores and findings
  const recommendations = generateRecommendations(
    visualQualityScore,
    audioQualityScore,
    contentEffectivenessScore,
    categories,
    labels,
    speechTranscriptions,
    shotChanges
  );
  
  // Extract video length from shot annotations if available
  let videoLength = '00:00';
  if (shotChanges.length > 0) {
    const lastShot = shotChanges[shotChanges.length - 1];
    if (lastShot.endTimeOffset?.seconds) {
      const seconds = Number(lastShot.endTimeOffset.seconds);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      videoLength = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }
  
  return {
    id,
    overallScore,
    summary: generateSummary(labels, shotLabels, speechTranscriptions),
    categories,
    recommendations,
    analysisDate: new Date().toISOString(),
    videoLength,
    adminSettings,
    productPageUrl: adminSettings?.productPageUrl,
  };
}

// Calculate a score for visual quality based on label detections
function calculateVisualQualityScore(
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  frameLabels: EnhancedLabelAnnotation[]
): number {
  // If no labels were detected, return a low score
  if (labels.length === 0 && shotLabels.length === 0 && frameLabels.length === 0) {
    return 40;
  }
  
  // Start with a base score
  let score = 70;
  
  // More detected labels generally indicate better visual content
  score += Math.min(labels.length, 10) * 1.5;
  
  // High-confidence detections indicate better quality
  const averageConfidence = [...labels, ...shotLabels, ...frameLabels]
    .reduce((sum, label) => sum + (label.confidence || 0), 0) / 
    (labels.length + shotLabels.length + frameLabels.length || 1);
  
  score += averageConfidence * 20;
  
  // Cap the score at 100
  return Math.min(Math.round(score), 100);
}

// Calculate score for audio quality based on speech transcriptions
function calculateAudioQualityScore(
  speechTranscriptions: SpeechTranscription[]
): number {
  // If no speech was detected, return a neutral score
  if (speechTranscriptions.length === 0) {
    return 60;
  }
  
  // Calculate average confidence across all transcriptions
  let totalConfidence = 0;
  let totalAlternatives = 0;
  
  for (const transcription of speechTranscriptions) {
    for (const alternative of transcription.alternatives || []) {
      totalConfidence += alternative.confidence || 0;
      totalAlternatives++;
    }
  }
  
  // Higher confidence indicates clearer audio
  const averageConfidence = totalAlternatives > 0 ? totalConfidence / totalAlternatives : 0;
  
  // Scale the confidence to a score
  return Math.round(60 + (averageConfidence * 40));
}

// Calculate score for content effectiveness based on various signals
function calculateContentEffectivenessScore(
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  shotChanges: any[],
  speechTranscriptions: SpeechTranscription[]
): number {
  let score = 65; // Start with a moderate baseline
  
  // More shot changes can indicate more dynamic, engaging content (up to a point)
  const shotChangesCount = shotChanges.length;
  if (shotChangesCount > 0 && shotChangesCount < 50) {
    score += Math.min(shotChangesCount, 15) * 1;
  } else if (shotChangesCount >= 50) {
    // Too many shot changes might be distracting
    score -= 10;
  }
  
  // Presence of speech indicates explanatory content, which is often more effective
  if (speechTranscriptions.length > 0) {
    score += 10;
  }
  
  // Diversity of detected labels suggests richer content
  const uniqueLabelDescriptions = new Set(
    [...labels, ...shotLabels].map(label => label.entity?.description)
  );
  score += Math.min(uniqueLabelDescriptions.size, 10) * 1;
  
  return Math.min(Math.round(score), 100);
}

// Generate categories with scores and feedback based on admin settings and video analysis
function generateCategories(
  selectedCategories: string[],
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  frameLabels: EnhancedLabelAnnotation[],
  speechTranscriptions: SpeechTranscription[],
  shotChanges: any[],
  explicitAnnotations: ExplicitContentFrame[]
): VideoAnalysisCategory[] {
  const categories: VideoAnalysisCategory[] = [];
  
  // If no categories were specifically selected, use default ones
  if (selectedCategories.length === 0) {
    selectedCategories = ['visual_quality', 'audio_quality', 'content_engagement'];
  }
  
  // Map each selected category to a score and feedback
  for (const category of selectedCategories) {
    switch (category) {
      case 'visual_quality':
        categories.push({
          name: 'visual_quality',
          score: calculateVisualQualityScore(labels, shotLabels, frameLabels),
          feedback: generateVisualQualityFeedback(labels, shotLabels, frameLabels)
        });
        break;
        
      case 'audio_quality':
        categories.push({
          name: 'audio_quality',
          score: calculateAudioQualityScore(speechTranscriptions),
          feedback: generateAudioQualityFeedback(speechTranscriptions)
        });
        break;
        
      case 'content_engagement':
        categories.push({
          name: 'content_engagement',
          score: calculateContentEffectivenessScore(labels, shotLabels, shotChanges, speechTranscriptions),
          feedback: generateContentEngagementFeedback(labels, shotLabels, shotChanges, speechTranscriptions)
        });
        break;
        
      case 'product_visibility':
        categories.push({
          name: 'product_visibility',
          score: calculateProductVisibilityScore(labels, shotLabels, frameLabels),
          feedback: generateProductVisibilityFeedback(labels, shotLabels, frameLabels)
        });
        break;
        
      case 'content_appropriateness':
        categories.push({
          name: 'content_appropriateness',
          score: calculateAppropriatenessScore(explicitAnnotations),
          feedback: generateAppropriatenessFeedback(explicitAnnotations)
        });
        break;
        
      // Add more category handlers as needed
      default:
        // For unknown categories, add a placeholder
        categories.push({
          name: category,
          score: 65,
          feedback: `The ${category} was analyzed but could not be scored precisely with the available data. Consider adding more specific details in the video for better analysis.`
        });
    }
  }
  
  return categories;
}

// Generate recommendations based on scores and analysis
function generateRecommendations(
  visualQualityScore: number,
  audioQualityScore: number,
  contentEffectivenessScore: number,
  categories: VideoAnalysisCategory[],
  labels: EnhancedLabelAnnotation[],
  speechTranscriptions: SpeechTranscription[],
  shotChanges: any[]
): string[] {
  const recommendations: string[] = [];
  
  // Visual quality recommendations
  if (visualQualityScore < 70) {
    recommendations.push('Improve visual quality by using better lighting and camera equipment.');
    recommendations.push('Consider filming in a well-lit environment with minimal distractions in the background.');
  }
  
  // Audio quality recommendations
  if (audioQualityScore < 70) {
    recommendations.push('Enhance audio clarity by using an external microphone rather than the built-in camera mic.');
    recommendations.push('Record in a quiet environment to minimize background noise.');
  }
  
  // Content effectiveness recommendations
  if (contentEffectivenessScore < 70) {
    recommendations.push('Improve engagement by adding more dynamic elements to your video.');
    
    // Check for shot change frequency
    if (shotChanges.length < 5) {
      recommendations.push('Include more scene changes or camera angles to make the video more visually interesting.');
    } else if (shotChanges.length > 50) {
      recommendations.push('Consider reducing the number of rapid scene changes, which can be distracting.');
    }
  }
  
  // Product-specific recommendations
  const productCategory = categories.find(c => c.name === 'product_visibility');
  if (productCategory && productCategory.score < 70) {
    recommendations.push('Make sure the product is clearly visible and shown from multiple angles.');
    recommendations.push('Dedicate more screen time to showcasing the product features.');
  }
  
  // If speech is detected but not with high confidence
  if (speechTranscriptions.length > 0 && audioQualityScore < 60) {
    recommendations.push('Consider adding captions or subtitles to improve clarity of the message.');
  }
  
  return recommendations;
}

// Generate a summary based on detected labels and transcriptions
function generateSummary(
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  speechTranscriptions: SpeechTranscription[]
): string {
  // Identify key objects and themes
  const allLabels = [...labels, ...shotLabels];
  const topLabels = allLabels
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 5)
    .map(label => label.entity?.description || '')
    .filter(Boolean);
  
  // Check if speech is present
  const hasSpeech = speechTranscriptions.length > 0;
  
  if (topLabels.length === 0) {
    return 'The video content could not be fully analyzed. Consider enhancing the visual clarity and content definition for better analysis results.';
  }
  
  let summary = `The video primarily features ${topLabels.join(', ')}`;
  
  if (hasSpeech) {
    summary += ` with accompanying narration or dialogue`;
  }
  
  summary += `. The content quality is ${allLabels.length > 10 ? 'rich and varied' : 'somewhat limited'}.`;
  
  return summary;
}

// Helper functions for generating feedback
function generateVisualQualityFeedback(
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  frameLabels: EnhancedLabelAnnotation[]
): string {
  const allLabels = [...labels, ...shotLabels, ...frameLabels];
  const labelCount = allLabels.length;
  const avgConfidence = allLabels.reduce((sum, label) => sum + (label.confidence || 0), 0) / (labelCount || 1);
  
  if (labelCount === 0) {
    return "No clear visual elements were detected, which suggests the video may have low resolution, poor lighting, or lack distinct visual content. Consider improving the visual clarity.";
  }
  
  if (avgConfidence > 0.8) {
    return `The visual quality is excellent. The video features clear, well-defined elements that are easily identifiable (${Math.round(avgConfidence * 100)}% confidence in detections).`;
  } else if (avgConfidence > 0.6) {
    return `The visual quality is good. Most elements are clear, though some scenes may benefit from better lighting or focus (${Math.round(avgConfidence * 100)}% confidence in detections).`;
  } else {
    return `The visual quality needs improvement. Many elements are difficult to identify with confidence (${Math.round(avgConfidence * 100)}% confidence in detections). Consider better lighting, camera focus, or higher resolution.`;
  }
}

function generateAudioQualityFeedback(speechTranscriptions: SpeechTranscription[]): string {
  if (speechTranscriptions.length === 0) {
    return "No speech was detected in the video. If there should be narration or dialogue, check your audio recording equipment or consider adding voice-over.";
  }
  
  let totalConfidence = 0;
  let totalAlternatives = 0;
  
  for (const transcription of speechTranscriptions) {
    for (const alternative of transcription.alternatives || []) {
      totalConfidence += alternative.confidence || 0;
      totalAlternatives++;
    }
  }
  
  const avgConfidence = totalAlternatives > 0 ? totalConfidence / totalAlternatives : 0;
  
  if (avgConfidence > 0.8) {
    return `The audio quality is excellent. Speech is clear and easily understandable (${Math.round(avgConfidence * 100)}% confidence in transcription).`;
  } else if (avgConfidence > 0.6) {
    return `The audio quality is good. Most speech is clear, though some sections may be less distinct (${Math.round(avgConfidence * 100)}% confidence in transcription).`;
  } else {
    return `The audio quality needs improvement. Speech is difficult to understand with confidence (${Math.round(avgConfidence * 100)}% confidence in transcription). Consider using an external microphone or recording in a quieter environment.`;
  }
}

function generateContentEngagementFeedback(
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  shotChanges: any[],
  speechTranscriptions: SpeechTranscription[]
): string {
  const shotCount = shotChanges.length;
  const hasSpeech = speechTranscriptions.length > 0;
  const uniqueContentCount = new Set([...labels, ...shotLabels].map(l => l.entity?.description)).size;
  
  let engagementLevel = "moderate";
  if (shotCount > 20 && hasSpeech && uniqueContentCount > 10) {
    engagementLevel = "high";
  } else if (shotCount < 5 && !hasSpeech && uniqueContentCount < 5) {
    engagementLevel = "low";
  }
  
  let feedback = `The content engagement level appears to be ${engagementLevel}. `;
  
  if (shotCount > 0) {
    feedback += `The video contains ${shotCount} scene changes, `;
    if (shotCount < 5) {
      feedback += "which may make the content feel static. Consider adding more dynamic elements. ";
    } else if (shotCount > 30) {
      feedback += "which creates a fast-paced feel, though potentially overwhelming. ";
    } else {
      feedback += "providing a good balance of visual interest. ";
    }
  }
  
  if (hasSpeech) {
    feedback += "The presence of narration or dialogue helps explain the content and maintain viewer interest. ";
  } else {
    feedback += "The absence of narration may make it difficult for viewers to fully understand the content. Consider adding explanatory voice-over. ";
  }
  
  if (uniqueContentCount > 10) {
    feedback += "The video showcases a diverse range of content elements, which helps maintain viewer engagement.";
  } else {
    feedback += "The video could benefit from featuring a wider variety of content elements to increase visual interest.";
  }
  
  return feedback;
}

function calculateProductVisibilityScore(
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  frameLabels: EnhancedLabelAnnotation[]
): number {
  // Start with a base score
  let score = 60;
  
  // More labeled frames generally indicate better product visibility
  const totalLabeledFrames = [...labels, ...shotLabels, ...frameLabels].length;
  score += Math.min(totalLabeledFrames, 20) * 1.5;
  
  // Higher label confidence indicates clearer product visibility
  const avgConfidence = [...labels, ...shotLabels, ...frameLabels].reduce(
    (sum, label) => sum + (label.confidence || 0), 0
  ) / (totalLabeledFrames || 1);
  
  score += avgConfidence * 20;
  
  return Math.min(Math.round(score), 100);
}

function generateProductVisibilityFeedback(
  labels: EnhancedLabelAnnotation[],
  shotLabels: EnhancedLabelAnnotation[],
  frameLabels: EnhancedLabelAnnotation[]
): string {
  const allLabels = [...labels, ...shotLabels, ...frameLabels];
  
  if (allLabels.length === 0) {
    return "No clear product visibility was detected. Ensure the product is prominently featured and well-lit throughout the video.";
  }
  
  const avgConfidence = allLabels.reduce((sum, label) => sum + (label.confidence || 0), 0) / allLabels.length;
  const score = calculateProductVisibilityScore(labels, shotLabels, frameLabels);
  
  if (score > 80) {
    return "The product visibility is excellent. The product is clearly shown from multiple angles and is prominently featured throughout the video.";
  } else if (score > 60) {
    return "The product visibility is good. The product is shown clearly in parts of the video, though some scenes could display it more prominently.";
  } else {
    return "The product visibility needs improvement. The product is not prominently featured or clearly displayed. Consider showing it from multiple angles with better lighting.";
  }
}

function calculateAppropriatenessScore(explicitAnnotations: ExplicitContentFrame[]): number {
  if (explicitAnnotations.length === 0) {
    return 100; // No explicit content detected
  }
  
  // Count frames with explicit content
  let explicitFrameCount = 0;
  for (const frame of explicitAnnotations) {
    if (frame.pornographyLikelihood === 'LIKELY' || frame.pornographyLikelihood === 'VERY_LIKELY') {
      explicitFrameCount++;
    }
  }
  
  // If any explicit frames are detected, lower the score
  if (explicitFrameCount > 0) {
    return Math.max(0, 100 - (explicitFrameCount * 5));
  }
  
  return 100;
}

function generateAppropriatenessFeedback(explicitAnnotations: ExplicitContentFrame[]): string {
  if (explicitAnnotations.length === 0) {
    return "The content appears to be appropriate for general audiences. No explicit or objectionable content was detected.";
  }
  
  // Count frames with likelihood of explicit content
  let explicitFrameCount = 0;
  for (const frame of explicitAnnotations) {
    if (frame.pornographyLikelihood === 'LIKELY' || frame.pornographyLikelihood === 'VERY_LIKELY') {
      explicitFrameCount++;
    }
  }
  
  if (explicitFrameCount > 0) {
    return `The content may contain ${explicitFrameCount} instances of potentially explicit or sensitive material. Review is recommended before publishing to ensure compliance with platform guidelines.`;
  }
  
  return "The content appears to be appropriate for general audiences, though some scenes may require review.";
}

// Use Vertex AI Gemini model to enhance the analysis with AI-generated observations
async function enhanceAnalysisWithAI(
  analysis: VideoAnalysisResult,
  annotationResults: EnhancedVideoAnnotationResults,
  gcsUri: string,
  adminSettings?: AdminSettings
): Promise<void> {
  try {
    console.log('=== Starting AI Enhancement Process ===');
    
    // Extract key information from the video analysis results
    const labelDescs = (annotationResults.labelAnnotations || [])
      .map(label => label.entity?.description)
      .filter(Boolean);
    console.log('Extracted Labels:', {
      count: labelDescs.length,
      labels: labelDescs
    });
      
    const shotLabelDescs = (annotationResults.shotLabelAnnotations || [])
      .map(label => label.entity?.description)
      .filter(Boolean);
    console.log('Extracted Shot Labels:', {
      count: shotLabelDescs.length,
      labels: shotLabelDescs
    });
      
    const transcriptTexts = (annotationResults.speechTranscriptions || [])
      .flatMap(t => (t.alternatives || []).map(alt => alt.transcript))
      .filter(Boolean);
    console.log('Extracted Transcripts:', {
      count: transcriptTexts.length,
      totalLength: transcriptTexts.join(' ').length,
      sample: transcriptTexts?.[0]?.substring(0, 100) + '...' || 'No transcript'
    });
      
    // Limit transcript length
    const truncatedTranscript = transcriptTexts.join(' ').length > 500 
      ? transcriptTexts.join(' ').substring(0, 500) + '...' 
      : transcriptTexts.join(' ');
    
    console.log('Preparing AI Prompt:', {
      hasProductUrl: !!adminSettings?.productPageUrl,
      selectedCategories: adminSettings?.selectedCategories || [],
      transcriptLength: truncatedTranscript.length
    });
      
    // Create a prompt for the AI to enhance the analysis
    const prompt = `You are a merchant analyzing a video review of your product. This video was created by a genuine customer who received a sample product from you. ${adminSettings?.productPageUrl ? `For more information about the product being reviewed, visit: ${adminSettings.productPageUrl}` : ''}

I have analyzed the video and detected the following:
    
Labels: ${labelDescs.join(', ')}
Shot Labels: ${shotLabelDescs.join(', ')}
Speech Transcript: "${truncatedTranscript || 'No speech detected'}"

Based solely on this detected content, please provide an analysis on the following categories ${adminSettings?.selectedCategories?.length ? '(focusing only on these selected categories: ' + adminSettings.selectedCategories.join(', ') + ')' : ''}:

- Product relevance: How relevant is the content to your product?
- Visual quality: How clear and visually appealing is the video?
- Audio quality: How clear and audible is the speech/sound?
- Content engagement: How engaging and interesting is the content?
- Talking head presence: Does the reviewer show their face and talk directly to the camera?
- Product visibility: How well is the product shown in the video?
- Use case demonstration: Does the reviewer demonstrate actual usage of the product?
- Unboxing or first impressions: Does the reviewer show the unboxing experience or initial impressions?
- Brand mention: Does the reviewer mention your brand name?
- Product mention: Does the reviewer mention the product name?
- Call to action (CTA): Does the reviewer include any calls to action?

For each relevant category, provide a score from 1-10 and brief feedback. Remember that these are authentic reviews from regular people, not professional video creators, so don't be overly strict about production quality.

Format your response as JSON:
{
  "summary": "2-3 sentence summary of the video content",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "categories": [
    {
      "name": "category name",
      "score": number between 1-10,
      "feedback": "brief feedback about this aspect"
    }
  ]
}`;

    console.log('Sending request to Vertex AI:', {
      promptLength: prompt.length,
      timestamp: new Date().toISOString()
    });

    // Generate content using Vertex AI
    const request = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    };
    
    const result = await model.generateContent(request);
    const response = await result.response;
    
    console.log('Received Vertex AI Response:', {
      hasResponse: !!response,
      candidatesCount: response.candidates?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn('No enhancement content generated from AI:', {
        response: JSON.stringify(response),
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const enhancementText = response.candidates[0].content.parts[0].text;
    console.log('AI Response Text:', {
      length: enhancementText.length,
      preview: enhancementText.substring(0, 100) + '...'
    });
    
    // Parse the AI response
    try {
      console.log('Attempting to parse AI response as JSON...');
      const jsonMatch = enhancementText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const enhancementData = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed AI response:', {
          hasSummary: !!enhancementData.summary,
          recommendationsCount: enhancementData.recommendations?.length || 0,
          categoriesCount: enhancementData.categories?.length || 0
        });
        
        // Update the analysis with AI-enhanced data
        if (enhancementData.summary) {
          analysis.summary = enhancementData.summary;
          console.log('Updated analysis summary');
        }
        
        if (enhancementData.recommendations?.length > 0) {
          const originalCount = analysis.recommendations.length;
          analysis.recommendations = [
            ...analysis.recommendations,
            ...enhancementData.recommendations.filter((r: string) => !analysis.recommendations.includes(r))
          ];
          console.log('Updated recommendations:', {
            originalCount,
            newCount: analysis.recommendations.length,
            addedCount: analysis.recommendations.length - originalCount
          });
        }

        if (enhancementData.categories?.length > 0) {
          analysis.categories = enhancementData.categories;
          console.log('Updated categories:', {
            count: enhancementData.categories.length,
            categoryNames: enhancementData.categories.map((c: any) => c.name)
          });
        }

        console.log('AI Enhancement Successfully Applied');
      } else {
        console.warn('No JSON object found in AI response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI enhancement:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        rawText: enhancementText
      });
    }
  } catch (error) {
    console.error('AI Enhancement Process Failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
  console.log('=== AI Enhancement Process Completed ===');
} 