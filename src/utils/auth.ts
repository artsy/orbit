import { getServerSession } from "next-auth"
import type { NextApiRequest, NextApiResponse } from "next"
import { UserWithAccessToken } from "system"
import { authOptions } from "pages/api/auth/[...nextauth].page"

export async function getSessionUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<UserWithAccessToken | undefined> {
  const session = await getServerSession(req, res, authOptions)
  return session?.user as UserWithAccessToken | undefined
}
