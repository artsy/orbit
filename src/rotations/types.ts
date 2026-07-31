/**
 * Shared type contract for the engineer rotation domain.
 *
 * This file is FROZEN after WP0 — every work package (logic, API, frontend)
 * imports from here so they can be built in parallel against a stable contract.
 *
 * Convention: all dates crossing the API boundary are ISO 8601 strings
 * (what `JSON.stringify(new Date())` produces). The pure logic module parses
 * them internally; it never depends on Prisma.
 */

// ---------------------------------------------------------------------------
// Entities (shape returned by the API — dates are ISO strings)
// ---------------------------------------------------------------------------

export interface Engineer {
  id: string
  name: string
  email: string
  /** Slack user ID (e.g. "U01427GSPK9") for @mentions — stable across renames. */
  slackUserId: string | null
  active: boolean
  createdAt: string
}

export interface Rotation {
  id: string
  name: string
  /** Length of one on-call period in days (weekly = 7). */
  cadenceDays: number
  /** Start of period 0; the round-robin is computed relative to this instant. */
  anchorDate: string
  timezone: string
  description: string | null
  createdAt: string
}

export interface RotationMember {
  id: string
  rotationId: string
  engineerId: string
  /** Zero-based order within the rotation's round-robin. */
  position: number
  /** Optionally populated by the API for convenience. */
  engineer?: Engineer
}

/**
 * A named group of engineers, independent of any rotation — a convenience
 * for bulk-adding its members to a rotation's on-call order. See /teams.
 */
export interface Team {
  id: string
  name: string
  createdAt: string
}

/** Membership in a Team. Unlike RotationMember, this is unordered. */
export interface TeamMember {
  id: string
  teamId: string
  engineerId: string
  /** Optionally populated by the API for convenience. */
  engineer?: Engineer
}

export interface Override {
  id: string
  rotationId: string
  /** Inclusive date range this override covers (ISO strings). */
  startDate: string
  endDate: string
  replacementEngineerId: string
  originalEngineerId: string | null
  reason: string | null
  createdByEmail: string
  /** Links the two reciprocal rows produced by a shift swap. */
  swapGroupId: string | null
  createdAt: string
  /** Optionally populated by the API for convenience. */
  replacementEngineer?: Engineer
}

// ---------------------------------------------------------------------------
// Computed schedule (produced by the logic module, returned by /schedule)
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  /** Index of this period relative to the rotation's anchorDate. */
  periodIndex: number
  /** Start of the period (inclusive), ISO string. */
  periodStart: string
  /** End of the period (exclusive) — start of the next period, ISO string. */
  periodEnd: string
  /** Engineer the base round-robin assigns, or null if the rotation has no members. */
  baseEngineerId: string | null
  /** Engineer actually on-call after overrides are applied. */
  effectiveEngineerId: string | null
  /** The override responsible for a change, if any. */
  override: Override | null
}

export interface ScheduleResponse {
  rotation: Rotation
  members: RotationMember[]
  entries: ScheduleEntry[]
}

/** One on-call slot: who is effectively on call and for which period. */
export interface OnCallSlot {
  engineer: Engineer | null
  /** Start of the period (inclusive), ISO string. */
  periodStart: string
  /** End of the period (exclusive), ISO string. */
  periodEnd: string
}

/** Convenience view of who's on call right now and next (see /on-call). */
export interface OnCallResponse {
  current: OnCallSlot | null
  next: OnCallSlot | null
}

/**
 * One row in the append-only Event Log — an audit trail of who did what,
 * when (see /events). `rotationId`/`rotationName` are a denormalized
 * snapshot, not a live reference, so they still show up after the rotation
 * itself is deleted.
 */
export interface EventLogEntry {
  id: string
  action: string
  summary: string
  actorEmail: string
  rotationId: string | null
  rotationName: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// API request bodies
// ---------------------------------------------------------------------------

export interface CreateEngineerBody {
  name: string
  email: string
  slackUserId?: string | null
  active?: boolean
}

export type UpdateEngineerBody = Partial<CreateEngineerBody>

export interface CreateRotationBody {
  name: string
  cadenceDays?: number
  anchorDate: string
  timezone?: string
  description?: string | null
}

export type UpdateRotationBody = Partial<CreateRotationBody>

/** Replace the full ordered membership of a rotation. `engineerIds[i]` gets position `i`. */
export interface SetMembersBody {
  engineerIds: string[]
}

export interface CreateTeamBody {
  name: string
}

export type UpdateTeamBody = Partial<CreateTeamBody>

/** Replace a team's full (unordered) roster. */
export interface SetTeamMembersBody {
  engineerIds: string[]
}

export interface CreateOverrideBody {
  startDate: string
  endDate: string
  replacementEngineerId: string
  originalEngineerId?: string | null
  reason?: string | null
  swapGroupId?: string | null
}

/** Editable fields of an existing override (see PATCH /api/overrides/[id]). */
export interface UpdateOverrideBody {
  startDate?: string
  endDate?: string
  replacementEngineerId?: string
  reason?: string | null
}

/** Swap the upcoming shifts of two engineers. */
export interface CreateSwapBody {
  engineerAId: string
  engineerBId: string
  /** A date inside engineer A's shift being given up. */
  dateA: string
  /** A date inside engineer B's shift being given up. */
  dateB: string
  reason?: string | null
}

// ---------------------------------------------------------------------------
// Generic API error envelope
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string
}
