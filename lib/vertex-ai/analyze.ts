import { model } from './client';
import type { VideoAnalysisResult, AdminSettings } from '../types';

export async function analyzeVideo(
  gcsUri: string,
  adminSettings?: AdminSettings
): Promise<VideoAnalysisResult> {
  try {
    // Construct the prompt based on admin settings
    const prompt = constructPrompt(gcsUri, adminSettings);

    // Generate content using Vertex AI
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }]
    });

    // Process the response
    const response = await result.response;
    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No analysis generated');
    }

    const analysisText = response.candidates[0].content.parts[0].text;

    // Parse the analysis text into structured data
    return parseAnalysisResponse(analysisText, gcsUri, adminSettings);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to analyze video: ${errorMessage}`);
  }
}

function constructPrompt(gcsUri: string, adminSettings?: AdminSettings): string {
  let prompt = `You are a professional video content reviewer. Please analyze the video at this Google Cloud Storage URI: ${gcsUri}

Please focus on:
1. Overall quality and professionalism
2. Content clarity and engagement
3. Technical aspects (video quality, audio quality, lighting)
4. Presentation style and delivery`;

  if (adminSettings?.productDescription) {
    prompt += `\n\nThis video is about the following product: ${adminSettings.productDescription}`;
  }

  if (adminSettings?.selectedCategories?.length) {
    prompt += `\n\nSpecifically evaluate these aspects: ${adminSettings.selectedCategories.join(', ')}`;
  }

  prompt += `\n\nProvide the analysis in the following JSON format:
{
  "overallScore": number (0-100),
  "summary": "brief overall assessment",
  "categories": [
    {
      "name": "category name",
      "score": number (0-100),
      "feedback": "detailed feedback"
    }
  ],
  "recommendations": [
    "specific improvement suggestion"
  ]
}`;

  return prompt;
}

function parseAnalysisResponse(text: string, gcsUri: string, adminSettings?: AdminSettings): VideoAnalysisResult {
  try {
    // Extract JSON from the response text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Generate a unique ID for the analysis
    const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate and structure the response
    return {
      id,
      overallScore: analysis.overallScore || 0,
      summary: analysis.summary || 'No summary provided',
      categories: analysis.categories || [],
      recommendations: analysis.recommendations || [],
      analysisDate: new Date().toISOString(),
      videoLength: '00:00', // This should be extracted from the video metadata
      adminSettings,
      productPageUrl: adminSettings?.productPageUrl,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to parse analysis response: ${errorMessage}`);
  }
} 