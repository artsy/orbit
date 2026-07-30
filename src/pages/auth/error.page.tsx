import { Button, Stack, Text } from "@artsy/palette"
import { useRouter } from "next/router"
import { federatedSignOut } from "utils/federatedSignOut"

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
            Signing out below clears your Artsy session too, so you can sign
            in again with an account that has the Gravity{" "}
            <code>team</code> role.
          </Text>
        </>
      ) : (
        <Text variant="sm" maxWidth={480}>
          Something went wrong signing in. Sign out and try again.
        </Text>
      )}

      <Button onClick={() => federatedSignOut("/")}>Sign out</Button>
    </Stack>
  )
}
