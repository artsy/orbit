/**
 * Pure turn-rotation logic: each submission goes to the next engineer in
 * order. No Prisma, no I/O, no clock reads, so server and browser can share it.
 */
import { RotationMember } from "rotations/types"

export interface TurnPick {
  engineerId: string
  nextPosition: number
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

export function pickNextTurn(
  members: RotationMember[],
  nextPosition: number
): TurnPick | null {
  const picked = pickBaseMember(members, nextPosition)
  if (!picked) return null
  return { engineerId: picked.engineerId, nextPosition: picked.position + 1 }
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
