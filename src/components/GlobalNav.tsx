import { Clickable, Flex, Stack, Text } from "@artsy/palette"
import ArtsyMarkIcon from "@artsy/icons/ArtsyMarkIcon"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/router"
import { useThemeMode } from "system/ThemeMode"
import type { UserWithAccessToken } from "system"

interface GlobalNavProps {
  user?: UserWithAccessToken
}

// A nav link that underlines and brightens when its section is active.
const NavLink: React.FC<{ href: string; active: boolean; label: string }> = ({
  href,
  active,
  label,
}) => (
  <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
    <Text
      variant="sm"
      style={{
        opacity: active ? 1 : 0.7,
        textDecoration: active ? "underline" : "none",
      }}
    >
      {label}
    </Text>
  </Link>
)

export const GlobalNav: React.FC<GlobalNavProps> = ({ user }) => {
  const router = useRouter()
  const { mode, toggle } = useThemeMode()

  const rotationsActive =
    router.pathname === "/" || router.pathname.startsWith("/rotations")
  const engineersActive = router.pathname.startsWith("/engineers")

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
            <NavLink href="/" active={rotationsActive} label="Rotations" />
            <NavLink
              href="/engineers"
              active={engineersActive}
              label="Engineers"
            />
          </>
        )}
      </Stack>

      <Flex alignItems="center" gap={2}>
        <Clickable onClick={toggle} aria-label="Toggle color theme">
          <Text variant="sm">{mode === "light" ? "Dark" : "Light"}</Text>
        </Clickable>
        {user && (
          <>
            <Text variant="xs" color="mono30">
              {user.email}
            </Text>
            <Clickable onClick={() => signOut({ callbackUrl: "/" })}>
              <Text variant="sm">Log out</Text>
            </Clickable>
          </>
        )}
      </Flex>
    </Flex>
  )
}
