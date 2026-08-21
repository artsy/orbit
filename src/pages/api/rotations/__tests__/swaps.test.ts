import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    rotation: {
      findUnique: jest.fn(),
    },
    rotationMember: {
      findMany: jest.fn(),
    },
    override: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import handler from "../[id]/swaps.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockRotationFindUnique = prisma.rotation.findUnique as jest.Mock
const mockMemberFindMany = prisma.rotationMember.findMany as jest.Mock
const mockOverrideFindMany = prisma.override.findMany as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

const ANCHOR = "2026-01-05T00:00:00.000Z"

const ROTATION = {
  id: "rotation-1",
  name: "Weekly On-Call",
  cadenceDays: 7,
  anchorDate: new Date(ANCHOR),
  timezone: "UTC",
  description: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

// Base order: eng-a (p0), eng-b (p1), eng-c (p2).
const MEMBERS = [
  {
    id: "m-a",
    rotationId: "rotation-1",
    engineerId: "eng-a",
    position: 0,
    engineer: {
      id: "eng-a",
      name: "A",
      email: "a@x.com",
      active: true,
      createdAt: new Date(),
    },
  },
  {
    id: "m-b",
    rotationId: "rotation-1",
    engineerId: "eng-b",
    position: 1,
    engineer: {
      id: "eng-b",
      name: "B",
      email: "b@x.com",
      active: true,
      createdAt: new Date(),
    },
  },
  {
    id: "m-c",
    rotationId: "rotation-1",
    engineerId: "eng-c",
    position: 2,
    engineer: {
      id: "eng-c",
      name: "C",
      email: "c@x.com",
      active: true,
      createdAt: new Date(),
    },
  },
]

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function buildReq(body: Record<string, unknown>) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: "POST",
    query: { id: "rotation-1" },
    body,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSessionUser.mockResolvedValue(TEAM_USER)
  mockRotationFindUnique.mockResolvedValue(ROTATION)
  mockMemberFindMany.mockResolvedValue(MEMBERS)
  mockOverrideFindMany.mockResolvedValue([])
  mockTransaction.mockResolvedValue([
    {
      id: "ov-a",
      rotationId: "rotation-1",
      startDate: new Date(ANCHOR),
      endDate: new Date(addDays(ANCHOR, 6)),
      replacementEngineerId: "eng-b",
      originalEngineerId: "eng-a",
      reason: null,
      createdByEmail: TEAM_USER.email,
      swapGroupId: "swap-1",
      createdAt: new Date(),
    },
    {
      id: "ov-b",
      rotationId: "rotation-1",
      startDate: new Date(addDays(ANCHOR, 7)),
      endDate: new Date(addDays(ANCHOR, 13)),
      replacementEngineerId: "eng-a",
      originalEngineerId: "eng-b",
      reason: null,
      createdByEmail: TEAM_USER.email,
      swapGroupId: "swap-1",
      createdAt: new Date(),
    },
  ])
})

describe("/api/rotations/[id]/swaps", () => {
  it("returns 400 when required fields are missing", async () => {
    const { req, res } = buildReq({ engineerAId: "eng-a" })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("201s on a fresh, valid swap and does not touch existing overrides", async () => {
    const { req, res } = buildReq({
      engineerAId: "eng-a",
      engineerBId: "eng-b",
      dateA: ANCHOR,
      dateB: addDays(ANCHOR, 7),
    })
    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(res._getJSONData() as any).toHaveLength(2)
  })

  it("400s when the named engineer is not effectively on call for that shift", async () => {
    // eng-a's *base* slot is period 0, but nothing has swapped anything in —
    // eng-a is not on call for period 1. This is exactly the request the old,
    // buggy UI could send.
    const { req, res } = buildReq({
      engineerAId: "eng-a",
      engineerBId: "eng-b",
      dateA: addDays(ANCHOR, 7), // period 1 -> eng-b, not eng-a
      dateB: addDays(ANCHOR, 14),
    })
    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("400s when both dates fall in the same period", async () => {
    const { req, res } = buildReq({
      engineerAId: "eng-a",
      engineerBId: "eng-a",
      dateA: ANCHOR,
      dateB: addDays(ANCHOR, 3),
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("201s on a swap chained off an existing one, without deleting the existing overrides", async () => {
    // swap-1: eng-a's period-0 shift <-> eng-c's period-2 shift. Effective:
    // p0 = eng-c, p1 = eng-b (base, untouched), p2 = eng-a.
    mockOverrideFindMany.mockResolvedValue([
      {
        id: "swap1-a",
        rotationId: "rotation-1",
        startDate: new Date(ANCHOR),
        endDate: new Date(addDays(ANCHOR, 6)),
        replacementEngineerId: "eng-c",
        originalEngineerId: "eng-a",
        reason: null,
        createdByEmail: TEAM_USER.email,
        swapGroupId: "swap-1",
        createdAt: new Date("2026-01-10T00:00:00.000Z"),
      },
      {
        id: "swap1-b",
        rotationId: "rotation-1",
        startDate: new Date(addDays(ANCHOR, 14)),
        endDate: new Date(addDays(ANCHOR, 20)),
        replacementEngineerId: "eng-a",
        originalEngineerId: "eng-c",
        reason: null,
        createdByEmail: TEAM_USER.email,
        swapGroupId: "swap-1",
        createdAt: new Date("2026-01-10T00:00:00.000Z"),
      },
    ])

    // Chain a second swap: eng-c's (now effective, not base) period-0 shift
    // <-> eng-b's period-1 shift — exactly the scenario reported.
    const { req, res } = buildReq({
      engineerAId: "eng-c",
      engineerBId: "eng-b",
      dateA: ANCHOR,
      dateB: addDays(ANCHOR, 7),
    })
    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    // The endpoint never deletes — chaining is pure layering.
    expect(mockOverrideFindMany).toHaveBeenCalled()
  })
})
