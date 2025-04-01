import { model } from './client';
import type { VideoAnalysisResult, AdminSettings } from '../types';
import fs from 'fs/promises';
import path from 'path';

export async function analyzeVideo(
  gcsUri: string,
  adminSettings?: AdminSettings,
  analysisId?: string
): Promise<VideoAnalysisResult> {
  const id = analysisId || `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  console.log('=== Starting Video Analysis Process using Gemini ===');
  console.log('Input Parameters:', { gcsUri, analysisId, adminSettings });

  try {
    // --- 1. Prepare Gemini Request ---
    console.log('Preparing Gemini request...');

    // Define the categories to request analysis for
    const defaultCategories = [
        "product_relevance", "visual_quality", "audio_quality",
        "content_engagement", "talking_head_presence", "product_visibility",
        "use_case_demonstration", "unboxing_or_first_impressions",
        "brand_mention", "product_mention", "call_to_action"
    ];
    const categoriesToAnalyze = adminSettings?.selectedCategories && adminSettings.selectedCategories.length > 0
        ? adminSettings.selectedCategories
        : defaultCategories;
    
    const categoryListString = categoriesToAnalyze.join(', ');

    // Prepare product context text
    const productContextText = adminSettings?.productPageUrl
      ? `The specific product being reviewed is detailed at this URL: ${adminSettings.productPageUrl}. You should consider this context *especially* when evaluating 'product_relevance'.`
      : 'No product page URL was provided for context.';

    // Construct the comprehensive prompt
    const prompt = `You are an expert video reviewer analyzing a customer-submitted video review.
${productContextText}

Analyze the provided video and generate a JSON response containing:
1.  A full "transcript" of all speech detected in the video. If multiple speakers are present, label them (e.g., Speaker A, Speaker B). If no speech is detected, return an empty string for the transcript.
2.  A concise 2-3 sentence "summary" of the video content.
3.  A list of actionable "recommendations" (as strings) for how the video could be improved, keeping in mind it's from a regular customer, not a professional.
4.  An analysis of the following specific "categories": ${categoryListString}. For each category, provide its "name", a "score" from 1-10 (integer), and brief "feedback" text.
    - For the 'product_relevance' category: Consider the product described at the provided URL (${adminSettings?.productPageUrl || 'URL not provided'}) when scoring and giving feedback. If no URL was provided, base the score only on the video content.
5.  The estimated "videoDuration" in MM:SS format.

Important: Respond *only* with a single, valid JSON object adhering to this exact structure:
{
  "transcript": "...",
  "summary": "...",
  "videoDuration": "MM:SS",
  "recommendations": ["...", "..."],
  "categories": [
    {"name": "category_name_1", "score": N, "feedback": "..."},
    {"name": "category_name_2", "score": N, "feedback": "..."}
    // ... include all requested categories ...
  ]
}`;

    console.log('Generated Gemini Prompt:', { promptLength: prompt.length });

    // Construct the parts array for the request (Linter Fix - Line 80 area)
    const videoPart = {
      fileData: { // Correct field name is likely fileData
        fileUri: gcsUri,
        mimeType: 'video/mp4',
      },
    };
    const textPart = { text: prompt };

    // Construct the request payload using the corrected parts structure
    const requestPayload = {
      contents: [{ role: 'user', parts: [videoPart, textPart] }],
    };

    // --- 2. Call Gemini API ---
    console.log('Sending request to Gemini model...'); 
    const result = await model.generateContent(requestPayload);
    const response = result.response;

    console.log('Received Gemini Response:', {
      candidatesCount: response.candidates?.length || 0,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings?.map(r => ({ category: r.category, probability: r.probability })),
    });

    // --- 3. Parse and Validate Response ---
    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      // Check for blocked content due to safety settings
      if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        console.error('Gemini response blocked due to safety settings:', response.candidates[0].safetyRatings);
        throw new Error('Analysis blocked due to safety concerns. Please review the video content.');
      }
      throw new Error('No text content returned from Gemini model.');
    }

    const responseText = response.candidates[0].content.parts[0].text;
    console.log('Raw Gemini Response Text Length:', responseText.length);

    let analysisData: {
        transcript: string;
        summary: string;
        videoDuration: string;
        recommendations: string[];
        categories: { name: string; score: number; feedback: string }[];
    };

    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error("No JSON object found in Gemini's response.");
        }
        analysisData = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed Gemini JSON response.');

        if (typeof analysisData.transcript !== 'string') console.warn("Missing or invalid 'transcript' in JSON response, setting to empty string.");
        if (!analysisData.summary || typeof analysisData.summary !== 'string') throw new Error("Missing or invalid 'summary' in JSON.");
        if (!analysisData.videoDuration || typeof analysisData.videoDuration !== 'string' || !/\\d+:\\d{2}/.test(analysisData.videoDuration)) console.warn(`Invalid or missing 'videoDuration' format ('${analysisData.videoDuration}'). Setting to N/A.`);
        if (!Array.isArray(analysisData.recommendations)) throw new Error("Missing or invalid 'recommendations' array in JSON.");
        if (!Array.isArray(analysisData.categories)) throw new Error("Missing or invalid 'categories' array in JSON.");
        
        if (analysisData.categories.length > 0) {
          for (const cat of analysisData.categories) {
              if (!cat.name || typeof cat.name !== 'string') throw new Error("Invalid category entry: missing name.");
              if (typeof cat.score !== 'number' || !Number.isInteger(cat.score) || cat.score < 1 || cat.score > 10) throw new Error(`Invalid category score for ${cat.name}: ${cat.score}. Must be integer 1-10.`);
              if (!cat.feedback || typeof cat.feedback !== 'string') throw new Error(`Invalid category feedback for ${cat.name}.`);
          }
        } else {
          console.warn('Gemini returned an empty categories array.');
        }
        console.log('Validated Gemini JSON structure.');

    } catch (parseError: unknown) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        console.error('Failed to parse or validate Gemini JSON response:', { error: errorMessage, rawText: responseText });
        throw new Error(`Failed to process Gemini response: ${errorMessage}`);
    }

    // --- 4. Calculate Overall Score ---
    let overallScore: number | null = null;
    let scoreError: string | undefined = undefined;

    const validCategories = analysisData.categories.filter(
        c => typeof c.score === 'number' && Number.isInteger(c.score) && c.score >= 1 && c.score <= 10
    );

    if (validCategories.length > 0) {
        const sumOfScores = validCategories.reduce((sum, cat) => sum + cat.score, 0);
        const averageScore = sumOfScores / validCategories.length;
        overallScore = Math.round(averageScore);
        console.log('Calculated overall score (1-10 scale):', overallScore);
    } else {
        scoreError = analysisData.categories 
            ? 'Score calculation failed: No valid category scores (1-10) returned by Gemini model.' 
            : 'Score calculation failed: Categories array missing or invalid in Gemini response.';
        console.warn(scoreError);
    }

    // --- 5. Construct Final Result ---
    const finalAnalysis: VideoAnalysisResult = {
        id,
        overallScore,
        scoreError,
        summary: analysisData.summary || "Summary not generated.",
        videoLength: (analysisData.videoDuration && /\\d+:\\d{2}/.test(analysisData.videoDuration)) ? analysisData.videoDuration : "N/A", 
        analysisDate: new Date().toISOString(),
        categories: Array.isArray(analysisData.categories) ? analysisData.categories : [], 
        recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [], 
        adminSettings,
        productPageUrl: adminSettings?.productPageUrl,
        transcript: typeof analysisData.transcript === 'string' ? analysisData.transcript : undefined, 
    };

    // --- 6. Save Analysis ---
    const analysisDir = path.join(process.cwd(), 'data', 'analysis');
    await fs.mkdir(analysisDir, { recursive: true });
    const analysisPath = path.join(analysisDir, `${finalAnalysis.id}.json`);
    await fs.writeFile(
        analysisPath,
        JSON.stringify(finalAnalysis, null, 2)
    );
    console.log('Analysis saved to file:', { path: analysisPath });

    console.log('=== Video Analysis Process using Gemini Completed Successfully ===');
    return finalAnalysis;

  } catch (error: unknown) {
    console.error('=== Video Analysis Process using Gemini Failed ===');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error Details:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    console.error('Failed Analysis Parameters:', { gcsUri, analysisId, adminSettingsProvided: !!adminSettings });
    throw new Error(`Failed to analyze video using Gemini: ${errorMessage}`);
  }
} 