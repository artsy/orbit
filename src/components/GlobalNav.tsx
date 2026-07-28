import { Clickable, Flex, Stack, Text } from "@artsy/palette"
import ArtsyMarkIcon from "@artsy/icons/ArtsyMarkIcon"
import { signOut } from "next-auth/react"
import Link from "next/link"
import type { UserWithAccessToken } from "system"

interface GlobalNavProps {
  user?: UserWithAccessToken
}

export const GlobalNav: React.FC<GlobalNavProps> = ({ user }) => {
  return (
    <Flex
      bg="mono100"
      color="mono0"
      justifyContent="space-between"
      alignItems="center"
      py={1}
      px={2}
    >
      <Stack flexDirection="row" gap={2} alignItems="center">
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          <Flex alignItems="center" gap={0.5}>
            <ArtsyMarkIcon fill="mono0" width={24} height={24} />
            <Text variant="lg-display">Orbit</Text>
          </Flex>
        </Link>
        {user && (
          <>
            <Link
              href="/"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Text variant="sm">Rotations</Text>
            </Link>
            <Link
              href="/engineers"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Text variant="sm">Engineers</Text>
            </Link>
          </>
        )}
      </Stack>

      {user && (
        <Flex alignItems="center" gap={2}>
          <Text variant="xs" color="mono30">
            {user.email}
          </Text>
          <Clickable onClick={() => signOut({ callbackUrl: "/" })}>
            <Text variant="sm">Log out</Text>
          </Clickable>
        </Flex>
      )}
    </Flex>
  )
}
