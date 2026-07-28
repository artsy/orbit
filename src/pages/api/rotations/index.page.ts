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
import { CreateRotationBody, Rotation } from "rotations/types"
import { isAllowedTimezone } from "rotations/timezones"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Rotation | Rotation[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "rotations", Action.read)) return

      const rotations = await prisma.rotation.findMany({
        orderBy: { name: "asc" },
      })
      return res.status(200).json(rotations.map(serializeRotation))
    }

    case "POST": {
      if (!requirePermission(res, user, "rotations", Action.manage)) return

      const body = req.body as Partial<CreateRotationBody>
      if (!body?.name || !body?.anchorDate) {
        return sendError(res, 400, "name and anchorDate are required")
      }

      const anchorDate = new Date(body.anchorDate)
      if (Number.isNaN(anchorDate.getTime())) {
        return sendError(res, 400, "anchorDate must be a valid ISO date")
      }

      if (body.timezone !== undefined && !isAllowedTimezone(body.timezone)) {
        return sendError(
          res,
          400,
          "timezone must be one of Europe/Berlin, Europe/London, America/New_York"
        )
      }

      const rotation = await prisma.rotation.create({
        data: {
          name: body.name,
          anchorDate,
          cadenceDays: body.cadenceDays ?? 7,
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.description !== undefined
            ? { description: body.description }
            : {}),
        },
      })
      return res.status(201).json(serializeRotation(rotation))
    }

    default:
      return methodNotAllowed(res)
  }
}
