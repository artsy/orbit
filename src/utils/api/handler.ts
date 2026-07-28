/**
 * Small shared helpers for API route handlers so each `.page.ts` file only
 * has to deal with its own business logic, not auth/permission boilerplate.
 */
import type { NextApiRequest, NextApiResponse } from "next"

import { Action, assertPermitted, Domain, UserWithAccessToken } from "system"
import { getSessionUser } from "utils/auth"
import { getServiceUser } from "utils/serviceAuth"

export function sendError(
  res: NextApiResponse,
  status: number,
  message: string
) {
  return res.status(status).json({ error: message })
}

/**
 * Resolves the session user, sending a 401 if there isn't one.
 * Returns `undefined` when it has already written a response — callers
 * should return immediately in that case.
 */
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<UserWithAccessToken | undefined> {
  // A valid service token authenticates a read-only machine principal; fall
  // back to the interactive session otherwise.
  const serviceUser = getServiceUser(req)
  if (serviceUser) return serviceUser

  const user = await getSessionUser(req, res)
  if (!user) {
    sendError(res, 401, "Unauthorized")
    return undefined
  }
  return user
}

/**
 * Asserts the user is permitted to perform `action` in `domain`, sending a
 * 403 (and returning `false`) if not.
 */
export function requirePermission(
  res: NextApiResponse,
  user: UserWithAccessToken,
  domain: Domain,
  action: Action
): boolean {
  try {
    assertPermitted(user, domain, action)
    return true
  } catch (e) {
    sendError(res, 403, (e as Error).message)
    return false
  }
}

export function methodNotAllowed(res: NextApiResponse) {
  return sendError(res, 405, "Method not allowed")
}
