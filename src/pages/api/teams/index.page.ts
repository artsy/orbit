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
import { CreateTeamBody, Team } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Team | Team[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "teams", Action.read)) return

      const teams = await prisma.team.findMany({
        orderBy: { name: "asc" },
      })
      return res.status(200).json(teams.map(serializeTeam))
    }

    case "POST": {
      if (!requirePermission(res, user, "teams", Action.manage)) return

      const body = req.body as Partial<CreateTeamBody>
      if (!body?.name) {
        return sendError(res, 400, "name is required")
      }

      const team = await prisma.team.create({
        data: { name: body.name },
      })
      await recordEvent(prisma, {
        action: "team.created",
        actorEmail: user.email as string,
        summary: `Created team "${team.name}"`,
      })
      return res.status(201).json(serializeTeam(team))
    }

    default:
      return methodNotAllowed(res)
  }
}
