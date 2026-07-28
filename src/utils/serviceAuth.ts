import type { NextApiRequest } from "next"
import { Role, UserWithAccessToken } from "system"

/**
 * Resolves a machine (service-token) principal for headless read access, e.g. a
 * Slack bot polling the schedule. A request carrying `Authorization: Bearer
 * <token>` whose token matches one configured in `ORBIT_SERVICE_TOKENS`
 * (comma-separated) is treated as a read-only `service` user. Returns
 * `undefined` when no tokens are configured or the header is absent/invalid, so
 * the normal session flow takes over.
 *
 * Kept free of the next-auth import chain so it's cheap to unit test.
 */
export function getServiceUser(
  req: NextApiRequest
): UserWithAccessToken | undefined {
  const configured = (process.env.ORBIT_SERVICE_TOKENS ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
  if (configured.length === 0) return undefined

  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) return undefined

  const presented = header.slice("Bearer ".length).trim()
  if (!presented || !configured.includes(presented)) return undefined

  return {
    name: "orbit-service",
    email: "service@orbit",
    accessToken: "",
    roles: [Role.service],
  } as UserWithAccessToken
}
