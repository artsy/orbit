import { Box, Button, Stack, Text, Toasts } from "@artsy/palette"
import { getProviders, signIn } from "next-auth/react"
import { useEffect, useState } from "react"
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
  // Render one button per provider configured in the next-auth route, so adding
  // a provider there surfaces a sign-in button automatically — no UI edit.
  const [providers, setProviders] = useState<
    Array<{ id: string; name: string }> | null
  >(null)

  useEffect(() => {
    getProviders().then((res) => {
      setProviders(
        res ? Object.values(res).map((p) => ({ id: p.id, name: p.name })) : []
      )
    })
  }, [])

  return (
    <>
      <header>
        <GlobalNav />
      </header>

      <Box as="main" mx="auto" p={2} py={[2, 4]} textAlign="center">
        {tokenValid === false && <Text my={4}>Please sign in to continue.</Text>}

        <Stack gap={1} alignItems="center">
          {providers && providers.length > 0 ? (
            providers.map((provider) => (
              <Button key={provider.id} onClick={() => signIn(provider.id)}>
                Continue with {provider.name}
              </Button>
            ))
          ) : (
            <Button onClick={() => signIn()}>Sign in</Button>
          )}
        </Stack>
      </Box>
    </>
  )
}
