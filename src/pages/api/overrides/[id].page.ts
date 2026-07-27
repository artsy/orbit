import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeOverride } from "utils/api/serialize"
import { Override } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Override | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method !== "DELETE") return methodNotAllowed(res)

  if (!requirePermission(res, user, "overrides", Action.manage)) return

  const id = req.query.id as string

  const existing = await prisma.override.findUnique({
    where: { id },
    include: { replacementEngineer: true },
  })
  if (!existing) return sendError(res, 404, "Override not found")

  const override = await prisma.override.delete({
    where: { id },
    include: { replacementEngineer: true },
  })
  return res.status(200).json(serializeOverride(override))
}
