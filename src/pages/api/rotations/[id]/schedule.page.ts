import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { getScheduleForRange } from "rotations/logic"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import {
  serializeMember,
  serializeOverride,
  serializeRotation,
} from "utils/api/serialize"
import { ScheduleResponse } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScheduleResponse | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method !== "GET") return methodNotAllowed(res)

  if (!requirePermission(res, user, "rotations", Action.read)) return

  const rotationId = req.query.id as string
  const { start, end } = req.query

  if (typeof start !== "string" || typeof end !== "string") {
    return sendError(res, 400, "start and end query params are required")
  }

  const rangeStart = new Date(start)
  const rangeEnd = new Date(end)
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return sendError(res, 400, "start and end must be valid ISO dates")
  }

  const rotation = await prisma.rotation.findUnique({
    where: { id: rotationId },
  })
  if (!rotation) return sendError(res, 404, "Rotation not found")

  const [members, overrides] = await Promise.all([
    prisma.rotationMember.findMany({
      where: { rotationId },
      orderBy: { position: "asc" },
      include: { engineer: true },
    }),
    prisma.override.findMany({
      where: {
        rotationId,
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
      },
      include: { replacementEngineer: true },
    }),
  ])

  const serializedRotation = serializeRotation(rotation)
  const serializedMembers = members.map(serializeMember)
  const serializedOverrides = overrides.map(serializeOverride)

  const entries = getScheduleForRange(
    serializedRotation,
    serializedMembers,
    serializedOverrides,
    rangeStart,
    rangeEnd
  )

  return res.status(200).json({
    rotation: serializedRotation,
    members: serializedMembers,
    entries,
  })
}
