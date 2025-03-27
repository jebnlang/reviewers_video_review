"use client"

import { ArrowUpCircle, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import type { VideoAnalysisResult } from "@/lib/types"

interface VideoRevisionRequestProps {
  results: VideoAnalysisResult
  revisionNotes?: string
}

export default function VideoRevisionRequest({ results, revisionNotes }: VideoRevisionRequestProps) {
  // Get the lowest scoring categories
  const lowScoreCategories = [...results.categories].sort((a, b) => a.score - b.score).slice(0, 3)

  return (
    <Card className="w-full overflow-hidden border-2 shadow-lg">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Revision Requested</h2>
          </div>
          <Badge variant="destructive" className="text-sm px-3 py-1">
            Score: {results.overallScore}/100
          </Badge>
        </div>
      </div>

      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-2">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <CardTitle className="text-2xl">Video Needs Improvement</CardTitle>
        <CardDescription>Please address the following issues and submit a revised version</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {revisionNotes && (
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h3 className="font-medium text-amber-800 mb-2">Reviewer Notes</h3>
            <p className="text-sm text-amber-700 whitespace-pre-line">{revisionNotes}</p>
          </div>
        )}

        {results.productPageUrl && (
          <div className="bg-white p-4 rounded-lg border border-amber-100 mb-4">
            <h3 className="font-medium text-amber-800 mb-2">Product URL</h3>
            <a
              href={results.productPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline break-all"
            >
              {results.productPageUrl}
            </a>
          </div>
        )}

        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <h3 className="font-medium text-amber-800 mb-3 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
            Key Issues to Address
          </h3>

          <div className="space-y-4">
            {lowScoreCategories.map((category, index) => (
              <div key={category.name} className="bg-white p-4 rounded-md border border-amber-100 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-amber-900">{category.name}</h4>
                  <Badge variant="destructive">{category.score}/100</Badge>
                </div>
                <Progress value={category.score} className="h-2 bg-amber-100" indicatorClassName="bg-amber-500" />
                <p className="text-sm text-amber-800">{category.feedback}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-medium mb-3">Recommended Improvements</h3>
          <ul className="space-y-2">
            {results.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="mt-0.5 min-w-4 text-amber-600">•</div>
                <p className="text-sm text-slate-700">{recommendation}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-5 rounded-lg border-2 border-dashed border-amber-300 text-center">
          <h3 className="font-medium text-amber-800 mb-2">Ready to Submit a Revised Video?</h3>
          <p className="text-sm text-slate-600 mb-4">
            Please address the issues above and upload a new version of your video
          </p>

          <Button
            asChild
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            <Link href="/" className="flex items-center">
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Upload Revised Video
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

