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
 * multiple overrides overlap `date`, the one created most recently wins.
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

  const winner = applicable.reduce((latest, candidate) =>
    parseISO(candidate.createdAt).getTime() >
    parseISO(latest.createdAt).getTime()
      ? candidate
      : latest
  )

  return { effectiveEngineerId: winner.replacementEngineerId, override: winner }
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
    const periodStart = periodStartInstant(rotation, periodIndex)
    const periodEnd = periodStartInstant(rotation, periodIndex + 1)

    const baseEngineerId = computeBaseAssignment(rotation, members, periodStart)
    const { effectiveEngineerId, override } = applyOverrides(
      baseEngineerId,
      overrides,
      periodStart
    )

    entries.push({
      periodIndex,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      baseEngineerId,
      effectiveEngineerId,
      override,
    })
  }

  return entries
}

/**
 * Builds the two reciprocal overrides that swap engineer A's shift
 * (covering dateA) with engineer B's shift (covering dateB).
 */
export function buildSwap(
  rotation: Rotation,
  members: RotationMember[],
  engineerAId: string,
  engineerBId: string,
  dateA: Date,
  dateB: Date,
  swapGroupId: string
): CreateOverrideBody[] {
  const boundsA = getPeriodBounds(rotation, dateA)
  const boundsB = getPeriodBounds(rotation, dateB)

  const originalA = computeBaseAssignment(
    rotation,
    members,
    boundsA.periodStart
  )
  const originalB = computeBaseAssignment(
    rotation,
    members,
    boundsB.periodStart
  )

  const coverForA: CreateOverrideBody = {
    startDate: boundsA.periodStart.toISOString(),
    endDate: addDays(boundsA.periodEnd, -1).toISOString(),
    replacementEngineerId: engineerBId,
    originalEngineerId: originalA,
    swapGroupId,
  }

  const coverForB: CreateOverrideBody = {
    startDate: boundsB.periodStart.toISOString(),
    endDate: addDays(boundsB.periodEnd, -1).toISOString(),
    replacementEngineerId: engineerAId,
    originalEngineerId: originalB,
    swapGroupId,
  }

  return [coverForA, coverForB]
}
