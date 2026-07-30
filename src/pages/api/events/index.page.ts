import type { NextApiRequest, NextApiResponse } from "next"

import { prisma } from "lib/db"
import { Action } from "system"
import {
  methodNotAllowed,
  requirePermission,
  requireUser,
} from "utils/api/handler"
import { serializeEvent } from "utils/api/serialize"
import { EventLogEntry } from "rotations/types"

const DEFAULT_LIMIT = 200

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EventLogEntry[] | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method !== "GET") return methodNotAllowed(res)

  if (!requirePermission(res, user, "events", Action.read)) return

  const rotationId = req.query.rotationId as string | undefined
  const limit = req.query.limit
    ? Math.min(Number(req.query.limit), 1000)
    : DEFAULT_LIMIT

  const events = await prisma.event.findMany({
    ...(rotationId ? { where: { rotationId } } : {}),
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
  })

  return res.status(200).json(events.map(serializeEvent))
}
