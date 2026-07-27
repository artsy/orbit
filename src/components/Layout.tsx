import { Box, Button, Text, Toasts } from "@artsy/palette"
import { signIn } from "next-auth/react"
import { GlobalNav } from "./GlobalNav"
import type { UserWithAccessToken } from "system"

interface LayoutProps {
  children?: React.ReactNode
  user?: UserWithAccessToken
  tokenValid: boolean
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  tokenValid,
}) => {
  return user && tokenValid ? (
    <AuthorizedLayout user={user}>{children}</AuthorizedLayout>
  ) : (
    <UnauthorizedLayout tokenValid={tokenValid} />
  )
}

const AuthorizedLayout: React.FC<{
  children?: React.ReactNode
  user: UserWithAccessToken
}> = ({ children, user }) => {
  return (
    <>
      <header>
        <GlobalNav user={user} />
      </header>

      <Box
        as="main"
        mx="auto"
        p={2}
        py={[2, 4]}
        width={1}
        maxWidth={["none", 768, 1280]}
      >
        {children}
      </Box>

      <Box position="fixed" zIndex={10} bottom={1} right={1} width={400}>
        <Toasts />
      </Box>
    </>
  )
}

const UnauthorizedLayout: React.FC<{ tokenValid: boolean }> = ({
  tokenValid,
}) => {
  return (
    <>
      <header>
        <GlobalNav />
      </header>

      <Box as="main" mx="auto" p={2} py={[2, 4]} textAlign="center">
        {tokenValid === false && <Text my={4}>Please sign in to continue.</Text>}
        <Button onClick={() => signIn("artsy")}>Log in with Artsy</Button>
      </Box>
    </>
  )
}
