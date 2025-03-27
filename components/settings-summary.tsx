import type { AdminSettings } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, LinkIcon } from "lucide-react"

// Map of category IDs to their display names
const CATEGORY_LABELS: Record<string, string> = {
  product_relevance: "Product Relevance",
  visual_quality: "Visual Quality",
  audio_quality: "Audio Quality",
  content_engagement: "Content Engagement",
  talking_head_presence: "Talking Head Presence",
  product_visibility: "Product Visibility",
  use_case_demonstration: "Use Case Demonstration",
  unboxing_first_impressions: "Unboxing or First Impressions",
  brand_mention: "Brand Mention",
  product_mention: "Product Mention",
  reviewer_sentiment: "Reviewer Sentiment",
  call_to_action: "Call to Action",
}

interface SettingsSummaryProps {
  settings: AdminSettings
}

export default function SettingsSummary({ settings }: SettingsSummaryProps) {
  const hasProductContext = settings.productPageUrl || settings.productDescription

  return (
    <Card className="w-full mt-6 border-indigo-100 bg-indigo-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
          <CheckCircle className="h-5 w-5" />
          Analysis Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasProductContext && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-indigo-900">Product Context</h3>

            {settings.productPageUrl && (
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="h-4 w-4 text-indigo-500" />
                <span className="text-indigo-700 font-medium">URL:</span>
                <span className="text-indigo-600 truncate">{settings.productPageUrl}</span>
              </div>
            )}

            {settings.productDescription && (
              <div className="text-sm">
                <span className="text-indigo-700 font-medium">Description:</span>
                <p className="text-indigo-600 mt-1 text-sm">
                  {settings.productDescription.length > 100
                    ? `${settings.productDescription.substring(0, 100)}...`
                    : settings.productDescription}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-indigo-900">Analysis Categories</h3>
          <div className="flex flex-wrap gap-2">
            {settings.selectedCategories.map((categoryId) => (
              <Badge key={categoryId} variant="outline" className="bg-white border-indigo-200 text-indigo-700">
                {CATEGORY_LABELS[categoryId] || categoryId}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

