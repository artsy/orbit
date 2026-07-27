import { addDays } from "date-fns"

import { Override, Rotation, RotationMember } from "rotations/types"

import {
  applyOverrides,
  buildSwap,
  computeBaseAssignment,
  getPeriodBounds,
  getScheduleForRange,
} from "../schedule"

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const ANCHOR = "2026-01-05T00:00:00.000Z"
const ANCHOR_DATE = new Date(ANCHOR)

function makeRotation(overrides: Partial<Rotation> = {}): Rotation {
  return {
    id: "rotation-1",
    name: "Weekly On-Call",
    cadenceDays: 7,
    anchorDate: ANCHOR,
    timezone: "UTC",
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

// ---------------------------------------------------------------------------
// computeBaseAssignment
// ---------------------------------------------------------------------------

describe("computeBaseAssignment", () => {
  const rotation = makeRotation()

  it("assigns the first member at the anchor date", () => {
    expect(computeBaseAssignment(rotation, THREE_MEMBERS, ANCHOR_DATE)).toBe(
      "eng-a"
    )
  })

  it("cycles round-robin across subsequent periods", () => {
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 7))
    ).toBe("eng-b")
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 14))
    ).toBe("eng-c")
  })

  it("wraps back around to the first member after a full cycle", () => {
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 21))
    ).toBe("eng-a")
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 28))
    ).toBe("eng-b")
  })

  it("stays within a period (does not roll over mid-period)", () => {
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 6))
    ).toBe("eng-a")
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 13))
    ).toBe("eng-b")
  })

  it("handles dates before the anchor with a non-negative wrap", () => {
    // period -1 spans days [-7, -1] -> wrapped index 2 -> eng-c
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, -1))
    ).toBe("eng-c")
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, -7))
    ).toBe("eng-c")
    // period -2 spans days [-14, -8] -> wrapped index 1 -> eng-b
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, -8))
    ).toBe("eng-b")
    // period -3 spans days [-21, -15] -> wrapped index 0 -> eng-a
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, -21))
    ).toBe("eng-a")
  })

  it("always returns the sole engineer for a single-member rotation", () => {
    const soloMembers = [makeMember("eng-solo", 0)]
    expect(computeBaseAssignment(rotation, soloMembers, ANCHOR_DATE)).toBe(
      "eng-solo"
    )
    expect(
      computeBaseAssignment(rotation, soloMembers, addDays(ANCHOR_DATE, 100))
    ).toBe("eng-solo")
    expect(
      computeBaseAssignment(rotation, soloMembers, addDays(ANCHOR_DATE, -100))
    ).toBe("eng-solo")
  })

  it("returns null when the rotation has no members", () => {
    expect(computeBaseAssignment(rotation, [], ANCHOR_DATE)).toBeNull()
  })

  it("sorts members by position rather than relying on array order", () => {
    const shuffled = [
      makeMember("eng-c", 2),
      makeMember("eng-a", 0),
      makeMember("eng-b", 1),
    ]
    expect(computeBaseAssignment(rotation, shuffled, ANCHOR_DATE)).toBe("eng-a")
  })

  it("clamps pathological cadence (< 1) to a single day", () => {
    const brokenRotation = makeRotation({ cadenceDays: 0 })
    expect(
      computeBaseAssignment(
        brokenRotation,
        THREE_MEMBERS,
        addDays(ANCHOR_DATE, 1)
      )
    ).toBe("eng-b")
  })
})

// ---------------------------------------------------------------------------
// getPeriodBounds
// ---------------------------------------------------------------------------

describe("getPeriodBounds", () => {
  const rotation = makeRotation()

  it("returns period 0 bounds for the anchor date", () => {
    const bounds = getPeriodBounds(rotation, ANCHOR_DATE)
    expect(bounds.periodIndex).toBe(0)
    expect(bounds.periodStart).toEqual(ANCHOR_DATE)
    expect(bounds.periodEnd).toEqual(addDays(ANCHOR_DATE, 7))
  })

  it("returns the correct bounds for a date mid-period", () => {
    const bounds = getPeriodBounds(rotation, addDays(ANCHOR_DATE, 10))
    expect(bounds.periodIndex).toBe(1)
    expect(bounds.periodStart).toEqual(addDays(ANCHOR_DATE, 7))
    expect(bounds.periodEnd).toEqual(addDays(ANCHOR_DATE, 14))
  })

  it("returns negative-index bounds for dates before the anchor", () => {
    const bounds = getPeriodBounds(rotation, addDays(ANCHOR_DATE, -3))
    expect(bounds.periodIndex).toBe(-1)
    expect(bounds.periodStart).toEqual(addDays(ANCHOR_DATE, -7))
    expect(bounds.periodEnd).toEqual(ANCHOR_DATE)
  })
})

// ---------------------------------------------------------------------------
// applyOverrides
// ---------------------------------------------------------------------------

describe("applyOverrides", () => {
  it("returns the base assignment untouched when no overrides apply", () => {
    const result = applyOverrides("eng-a", [], ANCHOR_DATE)
    expect(result).toEqual({ effectiveEngineerId: "eng-a", override: null })
  })

  it("applies an override that fully covers the period", () => {
    const override = makeOverride({
      startDate: ANCHOR,
      endDate: addDays(ANCHOR_DATE, 6).toISOString(),
      replacementEngineerId: "eng-cover",
    })
    const result = applyOverrides("eng-a", [override], addDays(ANCHOR_DATE, 3))
    expect(result.effectiveEngineerId).toBe("eng-cover")
    expect(result.override).toEqual(override)
  })

  it("respects inclusive start/end boundaries", () => {
    const override = makeOverride({
      startDate: addDays(ANCHOR_DATE, 1).toISOString(),
      endDate: addDays(ANCHOR_DATE, 3).toISOString(),
      replacementEngineerId: "eng-cover",
    })
    expect(
      applyOverrides("eng-a", [override], addDays(ANCHOR_DATE, 1))
        .effectiveEngineerId
    ).toBe("eng-cover")
    expect(
      applyOverrides("eng-a", [override], addDays(ANCHOR_DATE, 3))
        .effectiveEngineerId
    ).toBe("eng-cover")
  })

  it("does not apply an override outside its date range (partial overlap)", () => {
    const override = makeOverride({
      startDate: addDays(ANCHOR_DATE, 1).toISOString(),
      endDate: addDays(ANCHOR_DATE, 3).toISOString(),
      replacementEngineerId: "eng-cover",
    })
    // Day 5 is within the period but outside the override's range.
    const result = applyOverrides("eng-a", [override], addDays(ANCHOR_DATE, 5))
    expect(result).toEqual({ effectiveEngineerId: "eng-a", override: null })
  })

  it("picks the override with the latest createdAt when two overlap", () => {
    const older = makeOverride({
      id: "override-older",
      startDate: ANCHOR,
      endDate: addDays(ANCHOR_DATE, 6).toISOString(),
      replacementEngineerId: "eng-old",
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    const newer = makeOverride({
      id: "override-newer",
      startDate: addDays(ANCHOR_DATE, 2).toISOString(),
      endDate: addDays(ANCHOR_DATE, 4).toISOString(),
      replacementEngineerId: "eng-new",
      createdAt: "2026-01-02T00:00:00.000Z",
    })
    const result = applyOverrides(
      "eng-a",
      [older, newer],
      addDays(ANCHOR_DATE, 3)
    )
    expect(result.effectiveEngineerId).toBe("eng-new")
    expect(result.override?.id).toBe("override-newer")

    // Order in the input array should not matter.
    const reversed = applyOverrides(
      "eng-a",
      [newer, older],
      addDays(ANCHOR_DATE, 3)
    )
    expect(reversed.effectiveEngineerId).toBe("eng-new")
  })
})

// ---------------------------------------------------------------------------
// getScheduleForRange
// ---------------------------------------------------------------------------

describe("getScheduleForRange", () => {
  const rotation = makeRotation()

  it("produces one entry per period across the range, with correct bounds", () => {
    const entries = getScheduleForRange(
      rotation,
      THREE_MEMBERS,
      [],
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 20)
    )

    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.baseEngineerId)).toEqual([
      "eng-a",
      "eng-b",
      "eng-c",
    ])
    expect(entries.map((e) => e.effectiveEngineerId)).toEqual([
      "eng-a",
      "eng-b",
      "eng-c",
    ])
    expect(entries[0].periodIndex).toBe(0)
    expect(entries[0].periodStart).toBe(ANCHOR_DATE.toISOString())
    expect(entries[0].periodEnd).toBe(addDays(ANCHOR_DATE, 7).toISOString())
    expect(entries[1].periodStart).toBe(addDays(ANCHOR_DATE, 7).toISOString())
    expect(entries[2].periodStart).toBe(addDays(ANCHOR_DATE, 14).toISOString())
    entries.forEach((entry) => expect(entry.override).toBeNull())
  })

  it("applies an override only to the period(s) it covers", () => {
    const override = makeOverride({
      startDate: addDays(ANCHOR_DATE, 7).toISOString(),
      endDate: addDays(ANCHOR_DATE, 13).toISOString(),
      replacementEngineerId: "eng-fill-in",
      createdAt: "2026-01-06T00:00:00.000Z",
    })

    const entries = getScheduleForRange(
      rotation,
      THREE_MEMBERS,
      [override],
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 20)
    )

    expect(entries[0].effectiveEngineerId).toBe("eng-a")
    expect(entries[0].override).toBeNull()
    expect(entries[1].effectiveEngineerId).toBe("eng-fill-in")
    expect(entries[1].override).toEqual(override)
    expect(entries[2].effectiveEngineerId).toBe("eng-c")
    expect(entries[2].override).toBeNull()
  })

  it("returns null base/effective ids when the rotation has no members", () => {
    const entries = getScheduleForRange(
      rotation,
      [],
      [],
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 7)
    )
    expect(entries.length).toBeGreaterThan(0)
    entries.forEach((entry) => {
      expect(entry.baseEngineerId).toBeNull()
      expect(entry.effectiveEngineerId).toBeNull()
    })
  })

  it("handles a single-day range within one period", () => {
    const entries = getScheduleForRange(
      rotation,
      THREE_MEMBERS,
      [],
      addDays(ANCHOR_DATE, 2),
      addDays(ANCHOR_DATE, 2)
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].baseEngineerId).toBe("eng-a")
  })
})

// ---------------------------------------------------------------------------
// buildSwap
// ---------------------------------------------------------------------------

describe("buildSwap", () => {
  const rotation = makeRotation()

  it("builds two reciprocal overrides covering each engineer's full period", () => {
    const dateA = addDays(ANCHOR_DATE, 2) // period 0 -> base eng-a
    const dateB = addDays(ANCHOR_DATE, 9) // period 1 -> base eng-b

    const [coverForA, coverForB] = buildSwap(
      rotation,
      THREE_MEMBERS,
      "eng-a",
      "eng-b",
      dateA,
      dateB,
      "swap-group-1"
    )

    expect(coverForA.startDate).toBe(ANCHOR_DATE.toISOString())
    expect(coverForA.endDate).toBe(addDays(ANCHOR_DATE, 6).toISOString())
    expect(coverForA.replacementEngineerId).toBe("eng-b")
    expect(coverForA.originalEngineerId).toBe("eng-a")
    expect(coverForA.swapGroupId).toBe("swap-group-1")

    expect(coverForB.startDate).toBe(addDays(ANCHOR_DATE, 7).toISOString())
    expect(coverForB.endDate).toBe(addDays(ANCHOR_DATE, 13).toISOString())
    expect(coverForB.replacementEngineerId).toBe("eng-a")
    expect(coverForB.originalEngineerId).toBe("eng-b")
    expect(coverForB.swapGroupId).toBe("swap-group-1")
  })

  it("shares the same swapGroupId across both overrides", () => {
    const [coverForA, coverForB] = buildSwap(
      rotation,
      THREE_MEMBERS,
      "eng-a",
      "eng-c",
      ANCHOR_DATE,
      addDays(ANCHOR_DATE, 14),
      "swap-group-xyz"
    )
    expect(coverForA.swapGroupId).toBe(coverForB.swapGroupId)
    expect(coverForA.swapGroupId).toBe("swap-group-xyz")
  })

  it("works when both dates fall in the same period", () => {
    const [coverForA, coverForB] = buildSwap(
      rotation,
      THREE_MEMBERS,
      "eng-a",
      "eng-a",
      addDays(ANCHOR_DATE, 1),
      addDays(ANCHOR_DATE, 5),
      "swap-group-same"
    )
    expect(coverForA.startDate).toBe(coverForB.startDate)
    expect(coverForA.endDate).toBe(coverForB.endDate)
  })
})

// ---------------------------------------------------------------------------
// cadence and start-hour handling
// ---------------------------------------------------------------------------

describe("cadence and start-hour handling", () => {
  it("advances every 14 days for a biweekly cadence", () => {
    const rotation = makeRotation({ cadenceDays: 14 })
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, ANCHOR_DATE)
    ).toBe("eng-a")
    // day 13 is still period 0
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 13))
    ).toBe("eng-a")
    // day 14 rolls into period 1
    expect(
      computeBaseAssignment(rotation, THREE_MEMBERS, addDays(ANCHOR_DATE, 14))
    ).toBe("eng-b")
  })

  it("hands off at the anchor's start hour", () => {
    const rotation = makeRotation({
      anchorDate: "2026-01-05T10:00:00.000Z",
    })
    // one minute before the weekly handoff hour: still eng-a
    expect(
      computeBaseAssignment(
        rotation,
        THREE_MEMBERS,
        new Date("2026-01-12T09:59:00.000Z")
      )
    ).toBe("eng-a")
    // at the handoff hour: rolls to eng-b
    expect(
      computeBaseAssignment(
        rotation,
        THREE_MEMBERS,
        new Date("2026-01-12T10:00:00.000Z")
      )
    ).toBe("eng-b")
  })

  it("period bounds begin at the anchor hour", () => {
    const rotation = makeRotation({ anchorDate: "2026-01-05T10:00:00.000Z" })
    const bounds = getPeriodBounds(
      rotation,
      new Date("2026-01-07T00:00:00.000Z")
    )
    expect(bounds.periodStart.toISOString()).toBe("2026-01-05T10:00:00.000Z")
    expect(bounds.periodEnd.toISOString()).toBe("2026-01-12T10:00:00.000Z")
  })
})
