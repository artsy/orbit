import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeTeamMember } from "utils/api/serialize"
import { recordEvent } from "utils/api/events"
import { SetTeamMembersBody, TeamMember } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TeamMember | TeamMember[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  const teamId = req.query.id as string

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "teams", Action.read)) return

      const team = await prisma.team.findUnique({ where: { id: teamId } })
      if (!team) return sendError(res, 404, "Team not found")

      const members = await prisma.teamMember.findMany({
        where: { teamId },
        include: { engineer: true },
      })
      return res.status(200).json(members.map(serializeTeamMember))
    }

    case "PUT": {
      if (!requirePermission(res, user, "teams", Action.manage)) return

      const team = await prisma.team.findUnique({ where: { id: teamId } })
      if (!team) return sendError(res, 404, "Team not found")

      const body = req.body as Partial<SetTeamMembersBody>
      if (!Array.isArray(body?.engineerIds)) {
        return sendError(res, 400, "engineerIds must be an array")
      }

      const { engineerIds } = body as SetTeamMembersBody

      const members = await prisma.$transaction(async (tx) => {
        await tx.teamMember.deleteMany({ where: { teamId } })

        await tx.teamMember.createMany({
          data: engineerIds.map((engineerId) => ({
            teamId,
            engineerId,
          })),
        })

        await recordEvent(tx, {
          action: "team-membership.updated",
          actorEmail: user.email as string,
          summary: `Updated roster for "${team.name}" (${engineerIds.length} engineer(s))`,
        })

        return tx.teamMember.findMany({
          where: { teamId },
          include: { engineer: true },
        })
      })

      return res.status(200).json(members.map(serializeTeamMember))
    }

    default:
      return methodNotAllowed(res)
  }
}
