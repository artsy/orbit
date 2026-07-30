import { Button, Stack, Text } from "@artsy/palette"
import { signOut } from "next-auth/react"
import { useRouter } from "next/router"

export default function AuthErrorPage() {
  const router = useRouter()
  const email = router.query.email as string | undefined
  const error = router.query.error as string | undefined

  const isAccessDenied = error === "AccessDenied"

  return (
    <Stack gap={1} alignItems="center" my={4}>
      <Text variant="lg-display">Access denied</Text>

      {isAccessDenied ? (
        <>
          <Text variant="sm" maxWidth={480}>
            {email ? (
              <>
                You&apos;re signed in to Artsy as <strong>{email}</strong>, but
                this account doesn&apos;t have permission to use Orbit.
              </>
            ) : (
              <>This account doesn&apos;t have permission to use Orbit.</>
            )}
          </Text>
          <Text variant="sm" color="mono60" maxWidth={480}>
            Sign out, then sign in again with an Artsy account that has the
            Gravity <code>team</code> role.
          </Text>
        </>
      ) : (
        <Text variant="sm" maxWidth={480}>
          Something went wrong signing in. Sign out and try again.
        </Text>
      )}

      <Button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</Button>
    </Stack>
  )
}
