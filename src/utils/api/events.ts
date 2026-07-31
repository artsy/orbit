/**
 * Records an entry in the append-only Event Log — an audit trail of who did
 * what, when. Deliberately decoupled from Rotation/Engineer/Override (no
 * relations), so history survives even when the thing it describes is later
 * deleted. See the `Event` model in prisma/schema.prisma.
 */
import type { Prisma, PrismaClient } from "@prisma/client"

export type EventAction =
  | "rotation.created"
  | "rotation.updated"
  | "rotation.deleted"
  | "membership.updated"
  | "engineer.created"
  | "engineer.updated"
  | "engineer.deleted"
  | "override.created"
  | "override.updated"
  | "override.deleted"
  | "swap.created"
  | "team.created"
  | "team.updated"
  | "team.deleted"
  | "team-membership.updated"

export interface RecordEventParams {
  action: EventAction
  actorEmail: string
  summary: string
  rotationId?: string | null
  rotationName?: string | null
}

// `client` is either the top-level `prisma` client or a `tx` from an
// existing `$transaction` callback — pass `tx` when the caller is already in
// one, so the event write is atomic with the mutation it's recording.
export async function recordEvent(
  client: PrismaClient | Prisma.TransactionClient,
  params: RecordEventParams
) {
  await client.event.create({ data: params })
}
