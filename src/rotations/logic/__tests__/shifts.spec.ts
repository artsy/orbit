import { addDays } from "date-fns"

import { Override, Rotation, RotationMember } from "rotations/types"

import { buildSwap, getScheduleForRange } from "../schedule"
import { upcomingShiftsFor } from "../shifts"

const ANCHOR = "2026-01-05T00:00:00.000Z"
const ANCHOR_DATE = new Date(ANCHOR)

function makeRotation(overrides: Partial<Rotation> = {}): Rotation {
  return {
    id: "rotation-1",
    name: "Weekly On-Call",
    cadenceDays: 7,
    anchorDate: ANCHOR,
    timezone: "UTC",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeMember(
  engineerId: string,
  position: number,
  overrides: Partial<RotationMember> = {}
): RotationMember {
  return {
    id: `member-${engineerId}-${position}`,
    rotationId: "rotation-1",
    engineerId,
    position,
    ...overrides,
  }
}

function makeOverride(overrides: Partial<Override> = {}): Override {
  return {
    id: "override-1",
    rotationId: "rotation-1",
    startDate: ANCHOR,
    endDate: ANCHOR,
    replacementEngineerId: "eng-replacement",
    originalEngineerId: null,
    reason: null,
    createdByEmail: "someone@example.com",
    swapGroupId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const THREE_MEMBERS = [
  makeMember("eng-a", 0),
  makeMember("eng-b", 1),
  makeMember("eng-c", 2),
]

describe("upcomingShiftsFor", () => {
  const rotation = makeRotation()

  it("returns an engineer's own base shifts when nothing is overridden", () => {
    const entries = getScheduleForRange(
      rotation,
      THREE_MEMBERS,
      [],
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 20)
    )
    const shifts = upcomingShiftsFor(entries, "eng-b", ANCHOR_DATE)
    expect(shifts.map((e) => e.periodIndex)).toEqual([1])
  })

  it("excludes shifts that have already ended", () => {
    const entries = getScheduleForRange(
      rotation,
      THREE_MEMBERS,
      [],
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 20)
    )
    // "now" is after period 0 has ended.
    const shifts = upcomingShiftsFor(entries, "eng-a", addDays(ANCHOR_DATE, 8))
    expect(shifts.map((e) => e.periodIndex)).toEqual([])
  })

  it("orders soonest-first and is not limited to any fixed count", () => {
    const rotationBiweekly = makeRotation({ cadenceDays: 7 })
    const members = [makeMember("eng-solo", 0)]
    const entries = getScheduleForRange(
      rotationBiweekly,
      members,
      [],
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 30)
    )
    const shifts = upcomingShiftsFor(entries, "eng-solo", ANCHOR_DATE)
    expect(shifts.map((e) => e.periodIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it("follows a shift after a swap moves it off an engineer's base slot (regression)", () => {
    // eng-a's period-0 shift <-> eng-c's period-2 shift.
    const swap = buildSwap({
      rotation,
      members: THREE_MEMBERS,
      overrides: [],
      engineerAId: "eng-a",
      engineerBId: "eng-c",
      dateA: ANCHOR_DATE,
      dateB: addDays(ANCHOR_DATE, 14),
      swapGroupId: "swap-1",
    })
    if (!swap.ok) throw new Error("expected swap to build")
    const overrides = swap.overrides.map((o, i) =>
      makeOverride({
        ...o,
        id: `swap1-${i}`,
        createdAt: "2026-01-10T00:00:00.000Z",
      })
    )

    const entries = getScheduleForRange(
      rotation,
      THREE_MEMBERS,
      overrides,
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 20)
    )

    // eng-c is now effectively on call for period 0, even though eng-c's
    // *base* slot is period 2 — that's the shift they'd want to give up in a
    // follow-up swap, and the one the picker must offer.
    const engCShifts = upcomingShiftsFor(entries, "eng-c", ANCHOR_DATE)
    expect(engCShifts.map((e) => e.periodIndex)).toEqual([0])

    // eng-a symmetrically moved to period 2.
    const engAShifts = upcomingShiftsFor(entries, "eng-a", ANCHOR_DATE)
    expect(engAShifts.map((e) => e.periodIndex)).toEqual([2])

    // eng-b is untouched.
    const engBShifts = upcomingShiftsFor(entries, "eng-b", ANCHOR_DATE)
    expect(engBShifts.map((e) => e.periodIndex)).toEqual([1])
  })
})
