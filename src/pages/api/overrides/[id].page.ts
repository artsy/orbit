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
import { Override, UpdateOverrideBody } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Override | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method !== "DELETE" && req.method !== "PATCH") {
    return methodNotAllowed(res)
  }

  if (!requirePermission(res, user, "overrides", Action.manage)) return

  const id = req.query.id as string

  const existing = await prisma.override.findUnique({
    where: { id },
    include: { replacementEngineer: true },
  })
  if (!existing) return sendError(res, 404, "Override not found")

  if (req.method === "DELETE") {
    const override = await prisma.override.delete({
      where: { id },
      include: { replacementEngineer: true },
    })
    return res.status(200).json(serializeOverride(override))
  }

  // PATCH — update the editable fields of an existing override.
  const body = req.body as UpdateOverrideBody

  const data: {
    startDate?: Date
    endDate?: Date
    replacementEngineerId?: string
    reason?: string | null
  } = {}

  if (body.startDate !== undefined) {
    const parsed = new Date(body.startDate)
    if (Number.isNaN(parsed.getTime())) {
      return sendError(res, 400, "startDate must be a valid ISO date")
    }
    data.startDate = parsed
  }

  if (body.endDate !== undefined) {
    const parsed = new Date(body.endDate)
    if (Number.isNaN(parsed.getTime())) {
      return sendError(res, 400, "endDate must be a valid ISO date")
    }
    data.endDate = parsed
  }

  if (body.replacementEngineerId !== undefined) {
    data.replacementEngineerId = body.replacementEngineerId
  }

  if (body.reason !== undefined) {
    data.reason = body.reason
  }

  const override = await prisma.override.update({
    where: { id },
    data,
    include: { replacementEngineer: true },
  })
  return res.status(200).json(serializeOverride(override))
}
