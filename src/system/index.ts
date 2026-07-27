import intersection from "lodash/intersection"
import uniq from "lodash/uniq"
import type { User } from "next-auth"

export type UserWithAccessToken = User & {
  accessToken: string
  roles: string[]
}

// Gravity roles we recognize. `team` == general Artsy staff, which is the gate
// for using this internal tool.
export enum Role {
  team = "team",
  product_development = "product_development",
}

export enum Action {
  read = "read",
  manage = "manage",
}

// For each _domain_, a map of _actions_ to the authorized _roles_.
// Reads and writes both require Artsy staff (`team`); this is a collaborative
// internal tool where any team member may add overrides and swaps.
const PERMISSIONS: Record<string, Partial<Record<Action, Role[]>>> = {
  engineers: {
    [Action.read]: [Role.team],
    [Action.manage]: [Role.team],
  },
  rotations: {
    [Action.read]: [Role.team],
    [Action.manage]: [Role.team],
  },
  overrides: {
    [Action.read]: [Role.team],
    [Action.manage]: [Role.team],
  },
}

export type Domain = keyof typeof PERMISSIONS

export const isPermitted = (
  user: UserWithAccessToken | undefined,
  domain: Domain,
  action?: Action
): boolean => {
  const permittedRoles = action
    ? PERMISSIONS[domain][action] ?? []
    : flattenPermissions(domain)

  return intersection(user?.roles ?? [], permittedRoles).length > 0
}

export const assertPermitted = (
  user: UserWithAccessToken | undefined,
  domain: Domain,
  action?: Action
) => {
  if (!isPermitted(user, domain, action)) {
    const permittedRoles = buildPermittedRoles(domain)
    throw new Error(
      `Unauthorized: ${domain} requires role(s): ${permittedRoles.join(
        ", "
      )}. Please contact your product team for assistance.`
    )
  }
  return true
}

export const buildPermittedRoles = (domain: Domain): string[] => {
  return uniq(flattenPermissions(domain))
}

const flattenPermissions = (domain: Domain): Role[] => {
  return Object.values(PERMISSIONS[domain]).reduce<Role[]>(
    (previous, next) => previous.concat(next),
    []
  )
}
