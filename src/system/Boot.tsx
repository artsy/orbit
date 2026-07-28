import { ToastsProvider, injectGlobalStyles } from "@artsy/palette"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"
import { ThemeModeProvider } from "system/ThemeMode"

const { GlobalStyles } = injectGlobalStyles(`
  /* overrides and additions */
`)

interface BootProps {
  children?: React.ReactNode
  session: Session | null
}

export const Boot: React.FC<BootProps> = ({ children, session }) => {
  return (
    <SessionProvider session={session}>
      <ThemeModeProvider>
        <GlobalStyles />
        <ToastsProvider>{children}</ToastsProvider>
      </ThemeModeProvider>
    </SessionProvider>
  )
}
