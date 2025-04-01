"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { VideoAnalysisResult } from "@/lib/types"
import { Video, BarChart2, Lightbulb, Link2, Info } from "lucide-react"

interface VideoAnalysisResultsProps {
  results: VideoAnalysisResult
}

export default function VideoAnalysisResults({ results }: VideoAnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState("overview")

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600"
    if (score >= 6) return "text-amber-600"
    return "text-red-600"
  }

  return (
    <Card className="w-full overflow-hidden border-2 shadow-lg">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Video Analysis</h2>
          </div>
          {results.overallScore !== null ? (
            <Badge
              variant={results.overallScore >= 8 ? "success" : results.overallScore >= 6 ? "warning" : "destructive"}
              className="text-sm px-3 py-1"
            >
              Score: {results.overallScore}/10
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              Score Error
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-0">
        <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full rounded-none border-b">
            <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-indigo-50">
              <BarChart2 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2 data-[state=active]:bg-indigo-50">
              <BarChart2 className="h-4 w-4" />
              <span>Categories ({results.categories.length})</span>
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex items-center gap-2 data-[state=active]:bg-indigo-50">
              <Lightbulb className="h-4 w-4" />
              <span>Tips ({results.recommendations.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="p-6 space-y-6">
            <div className="space-y-4">
              {results.overallScore !== null ? (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative w-32 h-32 mb-4">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-4xl font-bold ${getScoreColor(results.overallScore)}`}>
                        {results.overallScore}
                      </span>
                    </div>
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle
                        className="text-gray-200"
                        strokeWidth="10"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                      />
                      <circle
                        className={`${results.overallScore >= 8 ? "text-green-500" : results.overallScore >= 6 ? "text-amber-500" : "text-red-500"}`}
                        strokeWidth="10"
                        strokeDasharray={`${results.overallScore * 25.1} 251`}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">Overall Score</h3>
                  <p className="text-muted-foreground mt-1">
                    {results.overallScore >= 8
                      ? "Excellent! Your video performs very well."
                      : results.overallScore >= 6
                        ? "Good work. Some improvements possible."
                        : "Needs improvement in several areas."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="text-xl font-semibold text-red-700">Score Calculation Error</h3>
                  <p className="text-muted-foreground mt-1 text-red-600">
                    {results.scoreError || "An unknown error occurred during score calculation."}
                  </p>
                </div>
              )}

              {results.adminSettings?.productDescription && (
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    Product Information
                  </h3>
                  <p className="text-slate-700 mb-2">{results.adminSettings.productDescription}</p>
                  
                  {results.adminSettings.productPageUrl && (
                    <div className="flex items-center mt-2">
                      <Link2 className="h-4 w-4 mr-2 text-indigo-600" />
                      <a
                        href={results.adminSettings.productPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline break-all text-sm"
                      >
                        {results.adminSettings.productPageUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h3 className="font-medium mb-2">Analysis Summary</h3>
                <p className="text-muted-foreground">{results.summary}</p>
              </div>

              {!results.adminSettings?.productDescription && results.productPageUrl && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Link2 className="h-4 w-4 mr-2" />
                    Product URL
                  </h3>
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

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h3 className="font-medium mb-3">Analysis Categories</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {results.categories.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="text-sm font-medium">{category.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      {category.score !== null ? (
                        <Badge variant={category.score >= 8 ? "success" : category.score >= 6 ? "warning" : "destructive"}>
                          {category.score}/10
                        </Badge>
                      ) : (
                        <Badge variant="secondary">N/A</Badge>
                      )}
                    </div>
                  ))}
                </div>
                <button 
                  className="mt-3 text-sm text-indigo-600 hover:underline flex items-center"
                  onClick={() => setActiveTab("categories")}
                >
                  View detailed category analysis
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4">
                    <path d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Video Length</h4>
                  <p className="font-semibold">{results.videoLength}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Analysis Date</h4>
                  <p className="font-semibold">{new Date(results.analysisDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="p-6 space-y-6">
            {results.categories.length === 0 ? (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <p className="text-muted-foreground">No categories were selected for analysis.</p>
              </div>
            ) : (
              results.categories.map((category, index) => (
                <div key={category.name} className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">{category.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                    {category.score !== null ? (
                      <Badge variant={category.score >= 8 ? "success" : category.score >= 6 ? "warning" : "destructive"}>
                        {category.score}/10
                      </Badge>
                    ) : (
                      <Badge variant="secondary">N/A</Badge>
                    )}
                  </div>
                  {category.score !== null ? (
                    <Progress
                      value={category.score * 10}
                      className="h-2 bg-slate-200"
                      indicatorClassName={
                        category.score >= 8 ? "bg-green-500" : category.score >= 6 ? "bg-amber-500" : "bg-red-500"
                      }
                    />
                  ) : (
                    <div className="h-2 bg-slate-200 rounded-full" />
                  )}
                  <p className="text-sm text-muted-foreground">{category.feedback}</p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="p-6 space-y-4">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
              <h3 className="font-medium text-indigo-700 mb-2 flex items-center">
                <Lightbulb className="h-5 w-5 mr-2" />
                Improvement Suggestions
              </h3>
              <p className="text-sm text-indigo-700/70 mb-4">
                Apply these recommendations to improve your video quality and engagement
              </p>
              {results.recommendations.length === 0 ? (
                <p className="text-center p-4 bg-white rounded-md shadow-sm">
                  No specific recommendations for this video.
                </p>
              ) : (
                <ul className="space-y-3">
                  {results.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex gap-3 bg-white p-3 rounded-md shadow-sm">
                      <span className="text-indigo-600 font-bold">{index + 1}.</span>
                      <span className="text-slate-700">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

