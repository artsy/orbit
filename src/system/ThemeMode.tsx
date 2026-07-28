import { Theme } from "@artsy/palette"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

type ThemeModeValue = "light" | "dark"

interface ThemeModeContextValue {
  mode: ThemeModeValue
  toggle: () => void
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "light",
  toggle: () => undefined,
})

export const useThemeMode = () => useContext(ThemeModeContext)

const STORAGE_KEY = "orbit-theme-mode"

/**
 * Provides light/dark theming for the whole app via @artsy/palette's `Theme`,
 * and exposes a `toggle` (used by the nav). The saved preference is read on the
 * client after mount to avoid a server/client hydration mismatch.
 */
export const ThemeModeProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setMode] = useState<ThemeModeValue>("light")

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "light" || saved === "dark") {
      setMode(saved)
    }
  }, [])

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      toggle: () =>
        setMode((current) => {
          const next = current === "light" ? "dark" : "light"
          window.localStorage.setItem(STORAGE_KEY, next)
          return next
        }),
    }),
    [mode]
  )

  return (
    <ThemeModeContext.Provider value={value}>
      <Theme theme={mode}>{children}</Theme>
    </ThemeModeContext.Provider>
  )
}
