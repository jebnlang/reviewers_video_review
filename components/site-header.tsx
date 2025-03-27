import Link from "next/link"
import { Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export function SiteHeader() {
  return (
    <header className="bg-background border-b sticky top-0 z-40">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <Video className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Reviewers.com</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.example.com/docs" target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
} 