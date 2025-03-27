"use client"

import type { AdminSettings } from "./types"

// Local storage key for admin settings
export const ADMIN_SETTINGS_KEY = 'reviewers_admin_settings';

// Client-side functions for localStorage
const clientStorage = {
  // Save settings to localStorage
  saveSettings: (settings: AdminSettings): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings))
      console.log("Client: Saved settings to localStorage")
    }
  },
  
  // Get settings from localStorage
  getSettings: (): AdminSettings | null => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem(ADMIN_SETTINGS_KEY)
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings)
          console.log("Client: Retrieved settings from localStorage")
          return parsedSettings
        } catch (error) {
          console.error("Failed to parse settings from localStorage", error)
        }
      }
    }
    return null
  }
}

export default clientStorage; 