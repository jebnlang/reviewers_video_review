"use client"

import { useState, useEffect } from "react"
import { Settings, Save, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { saveAdminSettings, getAdminSettings } from "@/lib/actions"
import clientStorage from "@/lib/client-storage"
import type { AdminSettings } from "@/lib/types"

const DEFAULT_CATEGORIES = [
  {
    id: "product_relevance",
    label: "Product Relevance",
    description: "How well the video showcases the product's features and benefits",
    isDefault: true,
  },
  {
    id: "visual_quality",
    label: "Visual Quality",
    description: "Clarity, lighting, and overall visual presentation",
    isDefault: true,
  },
  {
    id: "audio_quality",
    label: "Audio Quality",
    description: "Sound clarity, background noise, and voice quality",
    isDefault: true,
  },
  {
    id: "content_engagement",
    label: "Content Engagement",
    description: "How engaging and interesting the content is",
    isDefault: true,
  },
  {
    id: "talking_head_presence",
    label: "Talking Head Presence",
    description: "Reviewer appears on camera, enhancing authenticity and personal connection",
    isDefault: false,
  },
  {
    id: "product_visibility",
    label: "Product Visibility",
    description: "The product is clearly shown in the frame, including key features and details",
    isDefault: false,
  },
  {
    id: "use_case_demonstration",
    label: "Use Case Demonstration",
    description: "The product is used or demonstrated in real-life scenarios, showing functionality and benefits",
    isDefault: false,
  },
  {
    id: "unboxing_first_impressions",
    label: "Unboxing or First Impressions",
    description: "Captures initial reactions and unpacking experience, signaling authenticity and excitement",
    isDefault: false,
  },
  {
    id: "brand_mention",
    label: "Brand Mention",
    description: "The reviewer explicitly mentions the brand name, boosting brand awareness and recognition",
    isDefault: false,
  },
  {
    id: "product_mention",
    label: "Product Mention",
    description: "The specific product name or model is stated, improving searchability and clarity",
    isDefault: false,
  },
  {
    id: "reviewer_sentiment",
    label: "Reviewer Sentiment",
    description: "The tone and emotional delivery (positive, neutral, negative) reflecting user satisfaction",
    isDefault: false,
  },
  {
    id: "call_to_action",
    label: "Call to Action (CTA)",
    description: "The reviewer encourages the audience to buy, try, or learn more about the product",
    isDefault: false,
  },
]

interface AdminSettingsPanelProps {
  onClose: () => void
  onSave: (settings: AdminSettings) => void
}

export default function AdminSettingsPanel({ onClose, onSave }: AdminSettingsPanelProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [settings, setSettings] = useState<AdminSettings>({
    productPageUrl: "",
    productDescription: "",
    selectedCategories: DEFAULT_CATEGORIES.filter((cat) => cat.isDefault).map((cat) => cat.id),
  })

  useEffect(() => {
    const loadSettings = async () => {
      // First check localStorage
      const localSettings = clientStorage.getSettings()
      
      if (localSettings) {
        // Use localStorage settings if available
        setSettings(localSettings)
      } else {
        // Fall back to server settings
        const savedSettings = await getAdminSettings()
        if (savedSettings) {
          setSettings(savedSettings)
        }
      }
    }

    loadSettings()
  }, [])

  const handleCategoryToggle = (categoryId: string) => {
    setSettings((prev) => {
      const selected = [...prev.selectedCategories]

      if (selected.includes(categoryId)) {
        return {
          ...prev,
          selectedCategories: selected.filter((id) => id !== categoryId),
        }
      } else {
        return {
          ...prev,
          selectedCategories: [...selected, categoryId],
        }
      }
    })
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      // Make sure we're saving all the settings
      const settingsToSave = {
        productPageUrl: settings.productPageUrl.trim(),
        productDescription: settings.productDescription.trim(),
        selectedCategories: settings.selectedCategories,
      }

      // Save to localStorage first
      clientStorage.saveSettings(settingsToSave)
      
      // Then save to server
      await saveAdminSettings(settingsToSave)
      setSaveMessage("Settings saved successfully!")

      // Pass the settings to the parent component
      onSave(settingsToSave)

      // Close the modal after a short delay
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      setSaveMessage("Error saving settings")
      setTimeout(() => setSaveMessage(""), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-6 w-6" />
              <CardTitle>Admin Settings</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <CardDescription className="text-white/80">
            Configure AI analysis parameters and custom categories
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Product Context</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-4 w-4" />
                      <span className="sr-only">Info</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Providing product context helps the AI understand what the video is about and provide more
                      accurate analysis.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="product-url">Product Page URL</Label>
                <Input
                  id="product-url"
                  placeholder="https://example.com/product"
                  value={settings.productPageUrl}
                  onChange={(e) => setSettings({ ...settings, productPageUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">The URL of the product page being reviewed in the video</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">Product Description</Label>
                <Textarea
                  id="product-description"
                  placeholder="Describe the product and its key features..."
                  className="min-h-[100px]"
                  value={settings.productDescription}
                  onChange={(e) => setSettings({ ...settings, productDescription: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Provide context about the product to help the AI understand what to look for in the video
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Analysis Categories</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-4 w-4" />
                      <span className="sr-only">Info</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Select categories that the AI will use to analyze the video content.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Default Categories</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEFAULT_CATEGORIES.filter((category) => category.isDefault).map((category) => (
                  <div
                    key={category.id}
                    className="flex items-start space-x-3 border p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={settings.selectedCategories.includes(category.id)}
                      onCheckedChange={() => handleCategoryToggle(category.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`category-${category.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {category.label}
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h4 className="text-sm font-medium text-muted-foreground">Optional Categories</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEFAULT_CATEGORIES.filter((category) => !category.isDefault).map((category) => (
                  <div
                    key={category.id}
                    className="flex items-start space-x-3 border p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={settings.selectedCategories.includes(category.id)}
                      onCheckedChange={() => handleCategoryToggle(category.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`category-${category.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {category.label}
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t p-6 gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex items-center gap-4">
            {saveMessage && (
              <span className={`text-sm ${saveMessage.includes("Error") ? "text-red-500" : "text-green-500"}`}>
                {saveMessage}
              </span>
            )}
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {isSaving ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

