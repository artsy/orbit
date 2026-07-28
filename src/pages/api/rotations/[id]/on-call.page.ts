import type { NextApiRequest, NextApiResponse } from "next"
import { addDays } from "date-fns"

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
  serializeEngineer,
  serializeMember,
  serializeOverride,
  serializeRotation,
} from "utils/api/serialize"
import {
  Engineer,
  OnCallResponse,
  OnCallSlot,
  ScheduleEntry,
} from "rotations/types"

/**
 * Convenience endpoint: who is on call right now and who is next, with
 * overrides/swaps already applied. Saves callers (e.g. a Slack bot) from
 * fetching the whole schedule and doing the date math themselves.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OnCallResponse | { error: string }>
) {
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method !== "GET") return methodNotAllowed(res)

  if (!requirePermission(res, user, "rotations", Action.read)) return

  const rotationId = req.query.id as string

  const rotation = await prisma.rotation.findUnique({
    where: { id: rotationId },
  })
  if (!rotation) return sendError(res, 404, "Rotation not found")

  const now = new Date()
  // A window that always contains the current period and the next one.
  const rangeEnd = addDays(now, Math.max(rotation.cadenceDays, 1) * 2 + 1)

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
        endDate: { gte: now },
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
    now,
    rangeEnd
  )

  // Look up the effective engineer from the base members and any override
  // replacements (a replacement may not be a current member).
  const engineerById = new Map<string, Engineer>()
  members.forEach((member) => {
    if (member.engineer) {
      engineerById.set(member.engineer.id, serializeEngineer(member.engineer))
    }
  })
  overrides.forEach((override) => {
    if (override.replacementEngineer) {
      engineerById.set(
        override.replacementEngineer.id,
        serializeEngineer(override.replacementEngineer)
      )
    }
  })

  const toSlot = (entry: ScheduleEntry | undefined): OnCallSlot | null =>
    entry
      ? {
          engineer: entry.effectiveEngineerId
            ? engineerById.get(entry.effectiveEngineerId) ?? null
            : null,
          periodStart: entry.periodStart,
          periodEnd: entry.periodEnd,
        }
      : null

  const nowMs = now.getTime()
  const currentIndex = entries.findIndex(
    (entry) =>
      new Date(entry.periodStart).getTime() <= nowMs &&
      nowMs < new Date(entry.periodEnd).getTime()
  )

  const current = currentIndex === -1 ? undefined : entries[currentIndex]
  const next = currentIndex === -1 ? undefined : entries[currentIndex + 1]

  return res.status(200).json({ current: toSlot(current), next: toSlot(next) })
}
