import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeEngineer } from "utils/api/serialize"
import { Engineer, UpdateEngineerBody } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Engineer | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (!requirePermission(res, user, "engineers", Action.manage)) return

  const id = req.query.id as string

  switch (req.method) {
    case "PATCH": {
      const body = req.body as UpdateEngineerBody

      const existing = await prisma.engineer.findUnique({ where: { id } })
      if (!existing) return sendError(res, 404, "Engineer not found")

      const engineer = await prisma.engineer.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.slackUsername !== undefined
            ? { slackUsername: body.slackUsername }
            : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
      })
      return res.status(200).json(serializeEngineer(engineer))
    }

    case "DELETE": {
      const existing = await prisma.engineer.findUnique({ where: { id } })
      if (!existing) return sendError(res, 404, "Engineer not found")

      // Hard delete. Remove dependent rows first to avoid FK violations:
      // overrides this engineer covers are dropped, the originalEngineer
      // snapshot is nulled where it pointed at them, and their rotation
      // memberships are removed.
      const engineer = await prisma.$transaction(async (tx) => {
        await tx.override.deleteMany({ where: { replacementEngineerId: id } })
        await tx.override.updateMany({
          where: { originalEngineerId: id },
          data: { originalEngineerId: null },
        })
        await tx.rotationMember.deleteMany({ where: { engineerId: id } })
        return tx.engineer.delete({ where: { id } })
      })
      return res.status(200).json(serializeEngineer(engineer))
    }

    default:
      return methodNotAllowed(res)
  }
}
