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
import { CreateOverrideBody, Override } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Override | Override[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  const rotationId = req.query.id as string

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "overrides", Action.read)) return

      const rotation = await prisma.rotation.findUnique({
        where: { id: rotationId },
      })
      if (!rotation) return sendError(res, 404, "Rotation not found")

      const overrides = await prisma.override.findMany({
        where: { rotationId },
        include: { replacementEngineer: true },
        orderBy: { startDate: "asc" },
      })
      return res.status(200).json(overrides.map(serializeOverride))
    }

    case "POST": {
      if (!requirePermission(res, user, "overrides", Action.manage)) return

      const rotation = await prisma.rotation.findUnique({
        where: { id: rotationId },
      })
      if (!rotation) return sendError(res, 404, "Rotation not found")

      const body = req.body as Partial<CreateOverrideBody>
      if (!body?.startDate || !body?.endDate || !body?.replacementEngineerId) {
        return sendError(
          res,
          400,
          "startDate, endDate, and replacementEngineerId are required"
        )
      }

      const startDate = new Date(body.startDate)
      const endDate = new Date(body.endDate)
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return sendError(
          res,
          400,
          "startDate and endDate must be valid ISO dates"
        )
      }

      const override = await prisma.override.create({
        data: {
          rotationId,
          startDate,
          endDate,
          replacementEngineerId: body.replacementEngineerId,
          originalEngineerId: body.originalEngineerId ?? null,
          reason: body.reason ?? null,
          swapGroupId: body.swapGroupId ?? null,
          createdByEmail: user.email as string,
        },
        include: { replacementEngineer: true },
      })
      return res.status(201).json(serializeOverride(override))
    }

    default:
      return methodNotAllowed(res)
  }
}
