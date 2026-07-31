import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeTeam } from "utils/api/serialize"
import { recordEvent } from "utils/api/events"
import { Team, UpdateTeamBody } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Team | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  const id = req.query.id as string

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "teams", Action.read)) return

      const team = await prisma.team.findUnique({ where: { id } })
      if (!team) return sendError(res, 404, "Team not found")
      return res.status(200).json(serializeTeam(team))
    }

    case "PATCH": {
      if (!requirePermission(res, user, "teams", Action.manage)) return

      const existing = await prisma.team.findUnique({ where: { id } })
      if (!existing) return sendError(res, 404, "Team not found")

      const body = req.body as UpdateTeamBody

      const team = await prisma.team.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
        },
      })
      await recordEvent(prisma, {
        action: "team.updated",
        actorEmail: user.email as string,
        summary: `Updated team "${team.name}"`,
      })
      return res.status(200).json(serializeTeam(team))
    }

    case "DELETE": {
      if (!requirePermission(res, user, "teams", Action.manage)) return

      const existing = await prisma.team.findUnique({ where: { id } })
      if (!existing) return sendError(res, 404, "Team not found")

      const team = await prisma.team.delete({ where: { id } })
      await recordEvent(prisma, {
        action: "team.deleted",
        actorEmail: user.email as string,
        summary: `Deleted team "${existing.name}"`,
      })
      return res.status(200).json(serializeTeam(team))
    }

    default:
      return methodNotAllowed(res)
  }
}
