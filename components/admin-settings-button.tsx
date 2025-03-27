"use client"

import { useState, useEffect } from "react"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import AdminSettingsPanel from "@/components/admin-settings-panel"
import SettingsSummary from "@/components/settings-summary"
import type { AdminSettings } from "@/lib/types"
import { getAdminSettings } from "@/lib/actions"
import clientStorage from "@/lib/client-storage"

export default function AdminSettingsButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Function to load settings that can be called multiple times
  const loadSettings = async () => {
    setIsLoading(true)
    try {
      // First try to get settings from localStorage
      const localSettings = clientStorage.getSettings()
      
      if (localSettings) {
        // If we have local settings, use them
        setSettings(localSettings)
      } else {
        // Fall back to server-side settings if no local settings exist
        const savedSettings = await getAdminSettings()
        setSettings(savedSettings)
        // Store the server settings in localStorage for future use
        clientStorage.saveSettings(savedSettings)
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load settings on initial mount
  useEffect(() => {
    loadSettings()
  }, [])

  const handleSaveSettings = async (newSettings: AdminSettings) => {
    // Save to localStorage first
    clientStorage.saveSettings(newSettings)
    
    // Update the state with the new settings
    setSettings(newSettings)

    // Reload settings after a short delay to ensure we have the latest data
    setTimeout(() => {
      loadSettings()
    }, 1000)
  }

  return (
    <div className="w-full">
      {/* This displays the current admin settings that apply to all video analyses */}
      {isLoading ? (
        <div className="mt-6 p-4 border border-indigo-100 rounded-lg bg-indigo-50/50 text-center text-indigo-500">
          Loading settings...
        </div>
      ) : settings ? (
        <SettingsSummary settings={settings} />
      ) : null}

      <div className="flex justify-end mt-4">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="flex items-center gap-2 border-indigo-200 bg-white shadow-md hover:bg-indigo-50"
        >
          <Settings className="h-4 w-4 text-indigo-600" />
          <span>Admin Settings</span>
        </Button>
      </div>

      {isOpen && <AdminSettingsPanel onClose={() => setIsOpen(false)} onSave={handleSaveSettings} />}
    </div>
  )
}

