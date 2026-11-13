import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { pickNextTurn } from "rotations/logic"
import { Action } from "system"
import { recordEvent } from "utils/api/events"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
  sendError,
} from "utils/api/handler"
import { serializeEngineer, serializeMember } from "utils/api/serialize"
import { ClaimTurnBody, ClaimTurnResponse } from "rotations/types"

const MAX_REFERENCE_LENGTH = 100

type ClaimResult =
  | { status: number; error: string }
  | { engineer: ClaimTurnResponse["engineer"] }

/**
 * Assigns the next turn of a "turn" rotation and advances the pointer. The
 * row lock makes concurrent claims take turns instead of picking the same
 * engineer.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClaimTurnResponse | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method !== "POST") return methodNotAllowed(res)

  if (!requirePermission(res, user, "rotations", Action.claim)) return

  const rotationId = req.query.id as string
  const body = req.body as Partial<ClaimTurnBody> | undefined
  const reference =
    typeof body?.reference === "string"
      ? body.reference.trim().slice(0, MAX_REFERENCE_LENGTH)
      : ""

  const result = await prisma.$transaction(async (tx): Promise<ClaimResult> => {
    await tx.$queryRaw`SELECT id FROM "Rotation" WHERE id = ${rotationId} FOR UPDATE`

    const rotation = await tx.rotation.findUnique({
      where: { id: rotationId },
    })
    if (!rotation) return { status: 404, error: "Rotation not found" }
    if (rotation.kind !== "turn") {
      return { status: 400, error: "Rotation is not turn-based" }
    }

    const members = await tx.rotationMember.findMany({
      where: { rotationId },
      orderBy: { position: "asc" },
      include: { engineer: true },
    })

    const pick = pickNextTurn(
      members.map(serializeMember),
      rotation.nextPosition
    )
    if (!pick) return { status: 409, error: "Rotation has no active members" }

    const engineer = members.find(
      (m) => m.engineerId === pick.engineerId
    )?.engineer
    if (!engineer) return { status: 409, error: "Engineer not found" }

    await tx.rotation.update({
      where: { id: rotation.id },
      data: { nextPosition: pick.nextPosition },
    })

    await recordEvent(tx, {
      action: "rotation.turn_claimed",
      actorEmail: user.email as string,
      summary: `Assigned turn to ${engineer.name} on "${rotation.name}"${
        reference ? ` (${reference})` : ""
      }`,
      rotationId: rotation.id,
      rotationName: rotation.name,
    })

    return { engineer: serializeEngineer(engineer) }
  })

  if ("error" in result) return sendError(res, result.status, result.error)
  return res.status(200).json(result)
}
