import { VertexAI } from '@google-cloud/vertexai';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';

if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
  throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
}

if (!process.env.GOOGLE_CLOUD_LOCATION) {
  throw new Error('GOOGLE_CLOUD_LOCATION environment variable is not set');
}

// Initialize Vertex AI client
export const vertexai = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

// Get the model
export const model = vertexai.getGenerativeModel({
  model: 'gemini-2.0-flash-001',
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.4,
    topP: 1,
    topK: 32,
  },
});

// Initialize Video Intelligence client
export const videoIntelligenceClient = new VideoIntelligenceServiceClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
}); 