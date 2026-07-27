import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeRotation } from "utils/api/serialize"
import { Rotation, UpdateRotationBody } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Rotation | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  const id = req.query.id as string

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "rotations", Action.read)) return

      const rotation = await prisma.rotation.findUnique({ where: { id } })
      if (!rotation) return sendError(res, 404, "Rotation not found")
      return res.status(200).json(serializeRotation(rotation))
    }

    case "PATCH": {
      if (!requirePermission(res, user, "rotations", Action.manage)) return

      const existing = await prisma.rotation.findUnique({ where: { id } })
      if (!existing) return sendError(res, 404, "Rotation not found")

      const body = req.body as UpdateRotationBody

      if (body.anchorDate !== undefined) {
        const parsed = new Date(body.anchorDate)
        if (Number.isNaN(parsed.getTime())) {
          return sendError(res, 400, "anchorDate must be a valid ISO date")
        }
      }

      const rotation = await prisma.rotation.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.anchorDate !== undefined
            ? { anchorDate: new Date(body.anchorDate) }
            : {}),
          ...(body.cadenceDays !== undefined
            ? { cadenceDays: body.cadenceDays }
            : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        },
      })
      return res.status(200).json(serializeRotation(rotation))
    }

    case "DELETE": {
      if (!requirePermission(res, user, "rotations", Action.manage)) return

      const existing = await prisma.rotation.findUnique({ where: { id } })
      if (!existing) return sendError(res, 404, "Rotation not found")

      const rotation = await prisma.rotation.delete({ where: { id } })
      return res.status(200).json(serializeRotation(rotation))
    }

    default:
      return methodNotAllowed(res)
  }
}
