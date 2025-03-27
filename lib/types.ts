export interface VideoAnalysisCategory {
  name: string
  score: number
  feedback: string
}

export interface VideoAnalysisResult {
  id: string
  overallScore: number
  summary: string
  videoLength: string
  analysisDate: string
  categories: VideoAnalysisCategory[]
  recommendations: string[]
  productPageUrl?: string
  adminSettings?: AdminSettings
}

export interface AdminSettings {
  productPageUrl: string
  productDescription: string
  selectedCategories: string[]
}

