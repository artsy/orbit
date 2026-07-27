import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeMember } from "utils/api/serialize"
import { RotationMember, SetMembersBody } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RotationMember | RotationMember[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  const rotationId = req.query.id as string

  switch (req.method) {
    case "GET": {
      if (!requirePermission(res, user, "rotations", Action.read)) return

      const rotation = await prisma.rotation.findUnique({
        where: { id: rotationId },
      })
      if (!rotation) return sendError(res, 404, "Rotation not found")

      const members = await prisma.rotationMember.findMany({
        where: { rotationId },
        orderBy: { position: "asc" },
        include: { engineer: true },
      })
      return res.status(200).json(members.map(serializeMember))
    }

    case "PUT": {
      if (!requirePermission(res, user, "rotations", Action.manage)) return

      const rotation = await prisma.rotation.findUnique({
        where: { id: rotationId },
      })
      if (!rotation) return sendError(res, 404, "Rotation not found")

      const body = req.body as Partial<SetMembersBody>
      if (!Array.isArray(body?.engineerIds)) {
        return sendError(res, 400, "engineerIds must be an array")
      }

      const { engineerIds } = body as SetMembersBody

      const members = await prisma.$transaction(async (tx) => {
        await tx.rotationMember.deleteMany({ where: { rotationId } })

        await tx.rotationMember.createMany({
          data: engineerIds.map((engineerId, position) => ({
            rotationId,
            engineerId,
            position,
          })),
        })

        return tx.rotationMember.findMany({
          where: { rotationId },
          orderBy: { position: "asc" },
          include: { engineer: true },
        })
      })

      return res.status(200).json(members.map(serializeMember))
    }

    default:
      return methodNotAllowed(res)
  }
}
