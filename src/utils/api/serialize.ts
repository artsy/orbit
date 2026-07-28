/**
 * Converts Prisma rows (which use `Date` objects) into the contract shape
 * from `rotations/types` (which uses ISO 8601 strings), so they can be fed
 * straight into the pure logic module in `rotations/logic`.
 *
 * When sending JSON responses directly to the client, `res.json()` already
 * serializes `Date` -> ISO string, so these helpers are only needed where we
 * hand data to the logic module (or want a consistent shape either way).
 */
import type {
  Engineer as PrismaEngineer,
  Override as PrismaOverride,
  Rotation as PrismaRotation,
  RotationMember as PrismaRotationMember,
} from "@prisma/client"

import { Engineer, Override, Rotation, RotationMember } from "rotations/types"

export function serializeEngineer(engineer: PrismaEngineer): Engineer {
  return {
    id: engineer.id,
    name: engineer.name,
    email: engineer.email,
    slackUsername: engineer.slackUsername,
    slackUserId: engineer.slackUserId,
    active: engineer.active,
    createdAt: engineer.createdAt.toISOString(),
  }
}

export function serializeRotation(rotation: PrismaRotation): Rotation {
  return {
    id: rotation.id,
    name: rotation.name,
    cadenceDays: rotation.cadenceDays,
    anchorDate: rotation.anchorDate.toISOString(),
    timezone: rotation.timezone,
    description: rotation.description,
    createdAt: rotation.createdAt.toISOString(),
  }
}

export function serializeMember(
  member: PrismaRotationMember & { engineer?: PrismaEngineer }
): RotationMember {
  return {
    id: member.id,
    rotationId: member.rotationId,
    engineerId: member.engineerId,
    position: member.position,
    engineer: member.engineer ? serializeEngineer(member.engineer) : undefined,
  }
}

export function serializeOverride(
  override: PrismaOverride & { replacementEngineer?: PrismaEngineer }
): Override {
  return {
    id: override.id,
    rotationId: override.rotationId,
    startDate: override.startDate.toISOString(),
    endDate: override.endDate.toISOString(),
    replacementEngineerId: override.replacementEngineerId,
    originalEngineerId: override.originalEngineerId,
    reason: override.reason,
    createdByEmail: override.createdByEmail,
    swapGroupId: override.swapGroupId,
    createdAt: override.createdAt.toISOString(),
    replacementEngineer: override.replacementEngineer
      ? serializeEngineer(override.replacementEngineer)
      : undefined,
  }
}
