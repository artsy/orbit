import crypto from "crypto"

import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { buildSwap } from "rotations/logic"
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
import { CreateSwapBody, Override } from "rotations/types"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Override[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method !== "POST") return methodNotAllowed(res)

  if (!requirePermission(res, user, "overrides", Action.manage)) return

  const rotationId = req.query.id as string

  const body = req.body as Partial<CreateSwapBody>
  if (
    !body?.engineerAId ||
    !body?.engineerBId ||
    !body?.dateA ||
    !body?.dateB
  ) {
    return sendError(
      res,
      400,
      "engineerAId, engineerBId, dateA, and dateB are required"
    )
  }

  const dateA = new Date(body.dateA)
  const dateB = new Date(body.dateB)
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) {
    return sendError(res, 400, "dateA and dateB must be valid ISO dates")
  }

  const rotation = await prisma.rotation.findUnique({
    where: { id: rotationId },
  })
  if (!rotation) return sendError(res, 404, "Rotation not found")

  const members = await prisma.rotationMember.findMany({
    where: { rotationId },
    orderBy: { position: "asc" },
    include: { engineer: true },
  })

  const serializedRotation = serializeRotation(rotation)
  const serializedMembers = members.map(serializeMember)

  const swapGroupId = crypto.randomUUID()

  const [overrideForA, overrideForB] = buildSwap(
    serializedRotation,
    serializedMembers,
    body.engineerAId,
    body.engineerBId,
    dateA,
    dateB,
    swapGroupId
  )

  const created = await prisma.$transaction(async (tx) => {
    const createdA = await tx.override.create({
      data: {
        rotationId,
        startDate: new Date(overrideForA.startDate),
        endDate: new Date(overrideForA.endDate),
        replacementEngineerId: overrideForA.replacementEngineerId,
        originalEngineerId: overrideForA.originalEngineerId ?? null,
        reason: body.reason ?? null,
        swapGroupId,
        createdByEmail: user.email as string,
      },
      include: { replacementEngineer: true },
    })

    const createdB = await tx.override.create({
      data: {
        rotationId,
        startDate: new Date(overrideForB.startDate),
        endDate: new Date(overrideForB.endDate),
        replacementEngineerId: overrideForB.replacementEngineerId,
        originalEngineerId: overrideForB.originalEngineerId ?? null,
        reason: body.reason ?? null,
        swapGroupId,
        createdByEmail: user.email as string,
      },
      include: { replacementEngineer: true },
    })

    return [createdA, createdB]
  })

  return res.status(201).json(created.map(serializeOverride))
}
