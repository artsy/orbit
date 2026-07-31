import { Clickable, Flex, Stack, Text } from "@artsy/palette"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { federatedSignOut } from "utils/federatedSignOut"
import type { UserWithAccessToken } from "system"

interface GlobalNavProps {
  user?: UserWithAccessToken
}

// A nav link that underlines and brightens when its section is active. Its
// label never wraps mid-word — on narrow screens the whole link drops to the
// next line instead (see the wrapping Flex/Stack below).
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
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Text>
  </Link>
)

export const GlobalNav: React.FC<GlobalNavProps> = ({ user }) => {
  const router = useRouter()

  const rotationsActive =
    router.pathname === "/" || router.pathname.startsWith("/rotations")
  const engineersActive = router.pathname.startsWith("/engineers")

  return (
    <Flex
      bg="mono100"
      color="mono0"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={1}
      py={1}
      px={[1, 2]}
      width="100%"
    >
      <Stack
        flexDirection="row"
        flexWrap="wrap"
        gap={[1, 2]}
        alignItems="center"
      >
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          <Flex alignItems="center" gap={0.5}>
            <Image src="/logo.png" alt="" width={48} height={48} />
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

      <Flex alignItems="center" gap={[1, 2]} flexWrap="wrap">
        {user && (
          <>
            <Text
              variant="xs"
              color="mono30"
              display={["none", "block"]}
              style={{ whiteSpace: "nowrap" }}
            >
              {user.email}
            </Text>
            <Clickable onClick={() => federatedSignOut("/")}>
              <Text variant="sm" style={{ whiteSpace: "nowrap" }}>
                Log out
              </Text>
            </Clickable>
          </>
        )}
      </Flex>
    </Flex>
  )
}
