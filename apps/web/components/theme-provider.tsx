"use client"

import * as React from "react"

type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext) ?? { theme: "dark", resolvedTheme: "dark", setTheme: () => {} }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with dark; sync from the server-applied DOM class on first mount
  const [theme, setThemeState] = React.useState<Theme>("dark")

  React.useEffect(() => {
    setThemeState(document.documentElement.classList.contains("light") ? "light" : "dark")
  }, [])

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t)
    // Persist in a cookie so the server can read it on the next page load
    document.cookie = `theme=${t}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.classList.add(t)
  }, [])

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (!e.key || e.key.toLowerCase() !== "d") return
      const target = e.target as HTMLElement
      if (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      )
        return
      setTheme(theme === "dark" ? "light" : "dark")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [theme, setTheme])

  return <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>{children}</ThemeContext.Provider>
}
