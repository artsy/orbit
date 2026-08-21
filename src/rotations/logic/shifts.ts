/**
 * Pure helpers for "which shifts is this engineer on call for" — used to
 * populate the swap form's shift pickers. No DB/UI/IO, same rules as
 * `schedule.ts`.
 */
import { parseISO } from "date-fns"

import { ScheduleEntry } from "rotations/types"

/**
 * An engineer's upcoming on-call shifts, ordered soonest-first — based on who
 * is *effectively* on call for each period (after overrides/swaps), not just
 * their base round-robin slot.
 *
 * This matters once a swap has moved a shift onto someone's schedule that
 * isn't their base slot: filtering on `baseEngineerId` instead would miss it
 * entirely, making that shift impossible to select for a follow-up swap.
 */
export function upcomingShiftsFor(
  entries: ScheduleEntry[],
  engineerId: string,
  now: Date
): ScheduleEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.effectiveEngineerId === engineerId &&
        parseISO(entry.periodEnd).getTime() > now.getTime()
    )
    .sort(
      (a, b) =>
        parseISO(a.periodStart).getTime() - parseISO(b.periodStart).getTime()
    )
}
