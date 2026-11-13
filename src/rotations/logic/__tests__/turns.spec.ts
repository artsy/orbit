import { Engineer, Override, RotationMember } from "rotations/types"

import {
  carryNextPosition,
  pickBaseMember,
  pickNextTurn,
  todayInTimezone,
} from "../turns"

const TODAY = "2026-11-13"
const YESTERDAY = "2026-11-12"
const OLD = "2026-01-01T00:00:00.000Z"
const NEW = "2026-02-01T00:00:00.000Z"

function makeEngineer(id: string, active = true): Engineer {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    slackUserId: null,
    active,
    createdAt: OLD,
  }
}

function makeMember(
  engineerId: string,
  position: number,
  active = true
): RotationMember {
  return {
    id: `member-${engineerId}`,
    rotationId: "rotation-1",
    engineerId,
    position,
    engineer: makeEngineer(engineerId, active),
  }
}

function makeOverride({
  original,
  replacement,
  start = TODAY,
  end = TODAY,
  createdAt = OLD,
}: {
  original: string | null
  replacement: string
  start?: string
  end?: string
  createdAt?: string
}): Override {
  return {
    id: `override-${original}-${replacement}-${start}`,
    rotationId: "rotation-1",
    startDate: `${start.slice(0, 10)}T00:00:00.000Z`,
    endDate: `${end.slice(0, 10)}T00:00:00.000Z`,
    replacementEngineerId: replacement,
    originalEngineerId: original,
    reason: null,
    createdByEmail: "someone@example.com",
    swapGroupId: null,
    createdAt,
  }
}

const abc = [makeMember("a", 0), makeMember("b", 1), makeMember("c", 2)]
const withBInactive = [
  makeMember("a", 0),
  makeMember("b", 1, false),
  makeMember("c", 2),
]
const allInactive = [makeMember("a", 0, false), makeMember("b", 1, false)]

describe("pickBaseMember", () => {
  it("returns the first active member at or after nextPosition", () => {
    expect(pickBaseMember(abc, 1)?.engineerId).toBe("b")
  })

  it("orders by position, not array order", () => {
    const shuffled = [abc[2], abc[0], abc[1]]
    expect(pickBaseMember(shuffled, 1)?.engineerId).toBe("b")
  })

  it("returns null when there are no active members", () => {
    expect(pickBaseMember([], 0)).toBeNull()
    expect(pickBaseMember(allInactive, 0)).toBeNull()
  })
})

describe("pickNextTurn", () => {
  it("picks the member at nextPosition", () => {
    expect(pickNextTurn(abc, 1, [], TODAY)).toEqual({
      baseEngineerId: "b",
      effectiveEngineerId: "b",
      nextPosition: 2,
    })
  })

  it("wraps when nextPosition is past the end", () => {
    expect(pickNextTurn(abc, 5, [], TODAY)?.baseEngineerId).toBe("a")
  })

  it("skips inactive members", () => {
    expect(pickNextTurn(withBInactive, 1, [], TODAY)).toMatchObject({
      baseEngineerId: "c",
      nextPosition: 3,
    })
  })

  it("returns null with no active members", () => {
    expect(pickNextTurn([], 0, [], TODAY)).toBeNull()
    expect(pickNextTurn(allInactive, 0, [], TODAY)).toBeNull()
  })

  it("gives the turn to an override replacement covering today for that engineer", () => {
    expect(
      pickNextTurn(
        abc,
        1,
        [makeOverride({ original: "b", replacement: "z" })],
        TODAY
      )
    ).toEqual({
      baseEngineerId: "b",
      effectiveEngineerId: "z",
      nextPosition: 2,
    })
  })

  it("ignores overrides for other engineers or other dates", () => {
    const overrides = [
      makeOverride({ original: "a", replacement: "z" }),
      makeOverride({
        original: "b",
        replacement: "z",
        start: YESTERDAY,
        end: YESTERDAY,
      }),
    ]
    expect(pickNextTurn(abc, 1, overrides, TODAY)?.effectiveEngineerId).toBe(
      "b"
    )
  })

  it("uses the most recently created matching override", () => {
    const overrides = [
      makeOverride({ original: "b", replacement: "y", createdAt: OLD }),
      makeOverride({ original: "b", replacement: "z", createdAt: NEW }),
    ]
    expect(pickNextTurn(abc, 1, overrides, TODAY)?.effectiveEngineerId).toBe(
      "z"
    )
  })

  it("applies a one-day override on its own day", () => {
    const overrides = [
      makeOverride({
        original: "b",
        replacement: "z",
        start: "2026-11-13",
        end: "2026-11-13",
      }),
    ]
    expect(
      pickNextTurn(abc, 1, overrides, "2026-11-13")?.effectiveEngineerId
    ).toBe("z")
  })
})

describe("todayInTimezone", () => {
  it("uses the rotation's zone, not UTC", () => {
    expect(
      todayInTimezone("America/New_York", new Date("2026-11-14T02:00:00.000Z"))
    ).toBe("2026-11-13")
  })
})

describe("carryNextPosition", () => {
  it("follows the next-up engineer to their new position", () => {
    expect(carryNextPosition(abc, 1, ["c", "a", "b"])).toBe(2)
  })

  it("moves to whoever came after them when they are removed", () => {
    expect(carryNextPosition(abc, 1, ["a", "c"])).toBe(1)
  })

  it("wraps when everyone after them was removed", () => {
    expect(carryNextPosition(abc, 2, ["a", "b"])).toBe(0)
  })

  it("returns 0 for an empty new list", () => {
    expect(carryNextPosition(abc, 1, [])).toBe(0)
  })

  it("returns 0 when nobody old was active", () => {
    expect(carryNextPosition(allInactive, 1, ["a"])).toBe(0)
  })
})
