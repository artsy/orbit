/**
 * Pure rotation-scheduling logic.
 *
 * No Prisma, no React, no I/O, no Math.random/Date.now — every input the
 * computation needs (including "now") is passed in by the caller. This file
 * is safe to unit test with plain fixtures and to import from both API
 * routes and frontend code.
 */
import { TZDate } from "@date-fns/tz"
import { addDays, differenceInCalendarDays, parseISO } from "date-fns"

import {
  CreateOverrideBody,
  Override,
  Rotation,
  RotationMember,
  ScheduleEntry,
} from "rotations/types"

/** Non-negative modulo: always returns a value in [0, m). */
function nonNegativeMod(n: number, m: number): number {
  return ((n % m) + m) % m
}

const DAY_MS = 24 * 60 * 60 * 1000

/** cadenceDays < 1 is pathological input; clamp it to a single day. */
function effectiveCadenceDays(rotation: Rotation): number {
  return rotation.cadenceDays < 1 ? 1 : rotation.cadenceDays
}

/**
 * The instant at which period `n` begins. Computed in the rotation's timezone
 * so the handoff stays at the same wall-clock hour across DST changes — e.g.
 * "weekly at 10:00 America/New_York" is always 10:00 local, even though the
 * underlying UTC offset shifts by an hour twice a year.
 */
function periodStartInstant(rotation: Rotation, n: number): Date {
  const anchor = parseISO(rotation.anchorDate)
  const anchorInZone = new TZDate(anchor.getTime(), rotation.timezone)
  const start = addDays(anchorInZone, n * effectiveCadenceDays(rotation))
  return new Date(start.getTime())
}

function sortedEngineerIds(members: RotationMember[]): string[] {
  return [...members]
    // Skip deactivated engineers so they drop out of the round-robin. When the
    // engineer isn't populated on the member we can't tell, so we keep it.
    .filter((member) => member.engineer?.active !== false)
    .sort((a, b) => a.position - b.position)
    .map((member) => member.engineerId)
}

/** True when `date` falls within [start, end] inclusive, compared by calendar day. */
function isWithinInclusive(date: Date, start: Date, end: Date): boolean {
  return (
    differenceInCalendarDays(date, start) >= 0 &&
    differenceInCalendarDays(end, date) >= 0
  )
}

/**
 * Which round-robin period `date` falls in, relative to the rotation's
 * anchorDate. Works for dates before the anchor (negative periodIndex).
 */
function periodIndexForDate(rotation: Rotation, date: Date): number {
  const anchor = parseISO(rotation.anchorDate)
  // Estimate with fixed-length periods, then correct for any DST drift so that
  // periodStartInstant(n) <= date < periodStartInstant(n + 1).
  const approxMs = effectiveCadenceDays(rotation) * DAY_MS
  let n = Math.floor((date.getTime() - anchor.getTime()) / approxMs)
  while (periodStartInstant(rotation, n).getTime() > date.getTime()) n--
  while (periodStartInstant(rotation, n + 1).getTime() <= date.getTime()) n++
  return n
}

/**
 * The engineer the base round-robin assigns for the period containing
 * `date`, or `null` if the rotation has no members.
 */
export function computeBaseAssignment(
  rotation: Rotation,
  members: RotationMember[],
  date: Date
): string | null {
  const engineerIds = sortedEngineerIds(members)
  if (engineerIds.length === 0) {
    return null
  }

  const periodIndex = periodIndexForDate(rotation, date)
  const wrappedIndex = nonNegativeMod(periodIndex, engineerIds.length)
  return engineerIds[wrappedIndex]
}

/**
 * The rotation period containing `date`: its index and its start
 * (inclusive) / end (exclusive, i.e. the start of the next period).
 */
export function getPeriodBounds(
  rotation: Rotation,
  date: Date
): { periodIndex: number; periodStart: Date; periodEnd: Date } {
  const periodIndex = periodIndexForDate(rotation, date)
  const periodStart = periodStartInstant(rotation, periodIndex)
  const periodEnd = periodStartInstant(rotation, periodIndex + 1)
  return { periodIndex, periodStart, periodEnd }
}

/**
 * Applies any overrides active on `date` to the base assignment. When
 * multiple overrides overlap `date`, the one created most recently wins; ties
 * (equal `createdAt`) break on `id` so the winner is deterministic regardless
 * of the caller's array order or the database's row order.
 */
export function applyOverrides(
  baseEngineerId: string | null,
  overrides: Override[],
  date: Date
): { effectiveEngineerId: string | null; override: Override | null } {
  const applicable = overrides.filter((override) =>
    isWithinInclusive(
      date,
      parseISO(override.startDate),
      parseISO(override.endDate)
    )
  )

  if (applicable.length === 0) {
    return { effectiveEngineerId: baseEngineerId, override: null }
  }

  const winner = applicable.reduce((latest, candidate) => {
    const latestTime = parseISO(latest.createdAt).getTime()
    const candidateTime = parseISO(candidate.createdAt).getTime()
    if (candidateTime !== latestTime) {
      return candidateTime > latestTime ? candidate : latest
    }
    return candidate.id > latest.id ? candidate : latest
  })

  return { effectiveEngineerId: winner.replacementEngineerId, override: winner }
}

/**
 * Whether `override` is the one currently in effect for its own period — i.e.
 * nothing newer has been layered on top of it since. A swap's two rows can
 * fall out of sync with each other: a later swap may chain off only one of
 * them (see `isSwapGroupCurrent`).
 */
function isCurrentOverride(overrides: Override[], override: Override): boolean {
  const { override: winner } = applyOverrides(
    null,
    overrides,
    parseISO(override.startDate)
  )
  return winner?.id === override.id
}

/**
 * Whether every row in a swap group is still the one in effect for its own
 * period. `false` means a later swap has chained off at least one of this
 * swap's two periods.
 *
 * This matters because a swap's `replacementEngineerId` is a snapshot of
 * "whoever effectively held the other period" at creation time, not a live
 * reference — so modifying or deleting a group that a later swap has chained
 * off of reverts one of its periods to a stale value that can now duplicate
 * an engineer the later swap placed elsewhere. Only a group that is current
 * on both periods can be safely modified or deleted; undo/edit swaps
 * newest-first.
 */
export function isSwapGroupCurrent(
  overrides: Override[],
  group: Override[]
): boolean {
  return group.every((o) => isCurrentOverride(overrides, o))
}

/** The `ScheduleEntry` for a single period, by its index. */
function entryForPeriodIndex(
  rotation: Rotation,
  members: RotationMember[],
  overrides: Override[],
  periodIndex: number
): ScheduleEntry {
  const periodStart = periodStartInstant(rotation, periodIndex)
  const periodEnd = periodStartInstant(rotation, periodIndex + 1)

  const baseEngineerId = computeBaseAssignment(rotation, members, periodStart)
  const { effectiveEngineerId, override } = applyOverrides(
    baseEngineerId,
    overrides,
    periodStart
  )

  return {
    periodIndex,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    baseEngineerId,
    effectiveEngineerId,
    override,
  }
}

/**
 * The full `ScheduleEntry` (base assignment, effective assignment, and
 * whichever override is responsible) for the period containing `date`.
 */
export function effectiveAssignmentForDate(
  rotation: Rotation,
  members: RotationMember[],
  overrides: Override[],
  date: Date
): ScheduleEntry {
  return entryForPeriodIndex(
    rotation,
    members,
    overrides,
    periodIndexForDate(rotation, date)
  )
}

/**
 * One `ScheduleEntry` per rotation period overlapping [rangeStart, rangeEnd].
 */
export function getScheduleForRange(
  rotation: Rotation,
  members: RotationMember[],
  overrides: Override[],
  rangeStart: Date,
  rangeEnd: Date
): ScheduleEntry[] {
  const firstPeriodIndex = periodIndexForDate(rotation, rangeStart)
  const lastPeriodIndex = periodIndexForDate(rotation, rangeEnd)

  const entries: ScheduleEntry[] = []

  for (
    let periodIndex = firstPeriodIndex;
    periodIndex <= lastPeriodIndex;
    periodIndex++
  ) {
    entries.push(entryForPeriodIndex(rotation, members, overrides, periodIndex))
  }

  return entries
}

export interface BuildSwapParams {
  rotation: Rotation
  members: RotationMember[]
  /** Overrides already in effect on the rotation, so a swap that trades a
   * shift someone holds only because of an earlier override/swap (not their
   * base round-robin slot) is validated — and recorded — against who is
   * *actually* on call, not just the base rotation. */
  overrides: Override[]
  /** The engineer giving up the shift covering `dateA`. */
  engineerAId: string
  /** The engineer giving up the shift covering `dateB`. */
  engineerBId: string
  /** A date inside engineer A's shift being given up. */
  dateA: Date
  /** A date inside engineer B's shift being given up. */
  dateB: Date
  swapGroupId: string
}

export type BuildSwapResult =
  | { ok: true; overrides: [CreateOverrideBody, CreateOverrideBody] }
  | { ok: false; error: string }

/**
 * Builds the two reciprocal overrides that swap engineer A's shift
 * (covering dateA) with engineer B's shift (covering dateB) — or rejects the
 * request when it doesn't match who is actually on call.
 *
 * Both sides are validated against the *effective* schedule (base assignment
 * with `overrides` already applied), not just the base round-robin. This is
 * what lets swaps chain: a second swap that trades a shift someone holds
 * because of an earlier swap resolves correctly, and a request built from
 * stale data (an engineer who no longer holds that shift) is rejected instead
 * of silently corrupting the schedule.
 */
export function buildSwap(params: BuildSwapParams): BuildSwapResult {
  const {
    rotation,
    members,
    overrides,
    engineerAId,
    engineerBId,
    dateA,
    dateB,
    swapGroupId,
  } = params

  const boundsA = getPeriodBounds(rotation, dateA)
  const boundsB = getPeriodBounds(rotation, dateB)

  if (boundsA.periodIndex === boundsB.periodIndex) {
    return {
      ok: false,
      error:
        "dateA and dateB fall in the same period — pick two different shifts",
    }
  }

  if (engineerAId === engineerBId) {
    return { ok: false, error: "Engineer A and Engineer B must be different" }
  }

  const entryA = entryForPeriodIndex(
    rotation,
    members,
    overrides,
    boundsA.periodIndex
  )
  const entryB = entryForPeriodIndex(
    rotation,
    members,
    overrides,
    boundsB.periodIndex
  )

  if (entryA.effectiveEngineerId !== engineerAId) {
    return {
      ok: false,
      error: "Engineer A is not currently on call for the selected shift",
    }
  }
  if (entryB.effectiveEngineerId !== engineerBId) {
    return {
      ok: false,
      error: "Engineer B is not currently on call for the selected shift",
    }
  }

  const coverForA: CreateOverrideBody = {
    startDate: boundsA.periodStart.toISOString(),
    endDate: addDays(boundsA.periodEnd, -1).toISOString(),
    replacementEngineerId: engineerBId,
    originalEngineerId: engineerAId,
    swapGroupId,
  }

  const coverForB: CreateOverrideBody = {
    startDate: boundsB.periodStart.toISOString(),
    endDate: addDays(boundsB.periodEnd, -1).toISOString(),
    replacementEngineerId: engineerAId,
    originalEngineerId: engineerBId,
    swapGroupId,
  }

  return { ok: true, overrides: [coverForA, coverForB] }
}
