import { Engineer, RotationMember } from "rotations/types"

import { carryNextPosition, pickBaseMember, pickNextTurn } from "../turns"

const OLD = "2026-01-01T00:00:00.000Z"

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
    expect(pickNextTurn(abc, 1)).toEqual({ engineerId: "b", nextPosition: 2 })
  })

  it("wraps when nextPosition is past the end", () => {
    expect(pickNextTurn(abc, 5)?.engineerId).toBe("a")
  })

  it("skips inactive members", () => {
    expect(pickNextTurn(withBInactive, 1)).toEqual({
      engineerId: "c",
      nextPosition: 3,
    })
  })

  it("returns null with no active members", () => {
    expect(pickNextTurn([], 0)).toBeNull()
    expect(pickNextTurn(allInactive, 0)).toBeNull()
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
