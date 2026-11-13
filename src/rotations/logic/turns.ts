/**
 * Pure turn-rotation logic: each submission goes to the next engineer in
 * order. No Prisma, no I/O, no clock reads, so server and browser can share it.
 */
import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"

import { Override, RotationMember } from "rotations/types"

export interface TurnPick {
  baseEngineerId: string
  effectiveEngineerId: string
  nextPosition: number
}

/** `yyyy-MM-dd` for `now` in the given IANA timezone. */
export function todayInTimezone(timezone: string, now: Date): string {
  return format(new TZDate(now.getTime(), timezone), "yyyy-MM-dd")
}

function activeByPosition(members: RotationMember[]): RotationMember[] {
  return members
    .filter((member) => member.engineer?.active)
    .sort((a, b) => a.position - b.position)
}

export function pickBaseMember(
  members: RotationMember[],
  nextPosition: number
): RotationMember | null {
  const active = activeByPosition(members)
  return active.find((m) => m.position >= nextPosition) ?? active[0] ?? null
}

// Overrides are stored as UTC midnight of the chosen day, so comparing the
// date prefix as strings gives the same answer in every process timezone.
function coversDay(override: Override, today: string): boolean {
  return (
    override.startDate.slice(0, 10) <= today &&
    today <= override.endDate.slice(0, 10)
  )
}

export function pickNextTurn(
  members: RotationMember[],
  nextPosition: number,
  overrides: Override[],
  today: string
): TurnPick | null {
  const base = pickBaseMember(members, nextPosition)
  if (!base) return null

  const replacement = overrides
    .filter(
      (o) => o.originalEngineerId === base.engineerId && coversDay(o, today)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  return {
    baseEngineerId: base.engineerId,
    effectiveEngineerId: replacement?.replacementEngineerId ?? base.engineerId,
    nextPosition: base.position + 1,
  }
}

/**
 * Where `nextPosition` should point after the member list is replaced, so the
 * engineer who was next up keeps the turn (or the nearest later one does).
 */
export function carryNextPosition(
  oldMembers: RotationMember[],
  oldNextPosition: number,
  newEngineerIds: string[]
): number {
  const nextUp = pickBaseMember(oldMembers, oldNextPosition)
  if (!nextUp || newEngineerIds.length === 0) return 0

  const ordered = [...oldMembers].sort((a, b) => a.position - b.position)
  const start = ordered.findIndex((m) => m.engineerId === nextUp.engineerId)

  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[(start + i) % ordered.length].engineerId
    const index = newEngineerIds.indexOf(id)
    if (index !== -1) return index
  }
  return 0
}
