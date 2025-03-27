"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, AlertTriangle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import VideoPreview from "@/components/video-preview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { AdminSettings } from "@/lib/types"
import { settingsToUrlParams } from "@/lib/url-params"

interface VideoDecisionScreenProps {
  videoUrl: string
  videoName: string
  onCancel: () => void
  adminSettings?: AdminSettings | null
}

export default function VideoDecisionScreen({ 
  videoUrl, 
  videoName, 
  onCancel, 
  adminSettings
}: VideoDecisionScreenProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"pass" | "revision">("pass")
  const [revisionNotes, setRevisionNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate a random ID for the analysis
      const id = Math.random().toString(36).substring(2, 15)

      // Prepare base URL parameters
      const params = new URLSearchParams();
      params.append('decision', activeTab);
      
      if (activeTab === 'revision' && revisionNotes) {
        params.append('notes', revisionNotes);
      }
      
      // Add admin settings params if available
      if (adminSettings) {
        // Use the utility function to convert admin settings to URL parameters
        const settingsParams = settingsToUrlParams(adminSettings);
        
        // Merge the settings parameters into our main parameters
        settingsParams.forEach((value, key) => {
          params.append(key, value);
        });
      }

      // Navigate to the results page with all parameters
      router.push(`/results/${id}?${params.toString()}`);
    } catch (error) {
      console.error("Error processing decision:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full overflow-hidden border-2 shadow-lg">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-white">Video Review Decision</h2>
          </div>
        </div>
      </div>

      <CardHeader className="pb-0">
        <CardTitle className="text-center text-2xl">Review Complete</CardTitle>
        <CardDescription className="text-center">
          Please decide whether to pass this video or request revisions
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <VideoPreview url={videoUrl} />
          <div className="bg-slate-50 p-3 text-sm font-medium text-slate-700">{videoName}</div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "pass" | "revision")}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger
              value="pass"
              className="flex items-center gap-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Pass Video</span>
            </TabsTrigger>
            <TabsTrigger
              value="revision"
              className="flex items-center gap-2 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Request Revision</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pass" className="p-4 bg-green-50 rounded-md mt-4 border border-green-100">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-800">Pass This Video</h3>
                <p className="text-sm text-green-700 mt-1">
                  The video meets quality standards and will be approved. The uploader will see detailed analysis and
                  feedback.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="revision" className="p-4 bg-amber-50 rounded-md mt-4 border border-amber-100 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">Request Revisions</h3>
                <p className="text-sm text-amber-700 mt-1">
                  The video needs improvements before it can be approved. The uploader will be asked to submit a revised
                  version.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revision-notes" className="text-amber-800">
                Revision Notes (Optional)
              </Label>
              <Textarea
                id="revision-notes"
                placeholder="Add any specific feedback or instructions for the uploader..."
                className="min-h-[100px] border-amber-200 bg-white"
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-between space-x-4 pb-6 px-6">
        <Button variant="outline" onClick={onCancel} className="border-slate-200">
          Cancel
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`${
            activeTab === "pass"
              ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          }`}
        >
          {isSubmitting ? (
            "Processing..."
          ) : activeTab === "pass" ? (
            <span className="flex items-center">
              Approve Video
              <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          ) : (
            <span className="flex items-center">
              Request Revision
              <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

