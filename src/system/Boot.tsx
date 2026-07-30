import { Theme, ToastsProvider, injectGlobalStyles } from "@artsy/palette"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

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
      <Theme theme="light">
        <GlobalStyles />
        <ToastsProvider>{children}</ToastsProvider>
      </Theme>
    </SessionProvider>
  )
}
