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
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import handler from "../[id]/on-call.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockRotationFindUnique = prisma.rotation.findUnique as jest.Mock
const mockMemberFindMany = prisma.rotationMember.findMany as jest.Mock
const mockOverrideFindMany = prisma.override.findMany as jest.Mock

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

// Anchor well in the past so "now" always lands inside the computed schedule.
const ROTATION = {
  id: "rotation-1",
  name: "Weekly On-Call",
  cadenceDays: 7,
  anchorDate: new Date("2020-01-06T00:00:00.000Z"),
  timezone: "UTC",
  description: null,
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
}

const ENGINEER_A = {
  id: "eng-a",
  name: "Engineer A",
  email: "a@artsy.net",
  slackUserId: "U0AAA",
  active: true,
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
}

const MEMBER = {
  id: "member-1",
  rotationId: "rotation-1",
  engineerId: "eng-a",
  position: 0,
  engineer: ENGINEER_A,
}

const buildReq = () =>
  createMocks<NextApiRequest, NextApiResponse>({
    method: "GET",
    query: { id: "rotation-1" },
  })

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/rotations/[id]/on-call", () => {
  it("returns 401 when there is no session user", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)
    const { req, res } = buildReq()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(401)
  })

  it("returns 404 when the rotation does not exist", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockRotationFindUnique.mockResolvedValue(null)
    const { req, res } = buildReq()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(404)
  })

  it("returns 405 for unsupported methods", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { id: "rotation-1" },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })

  it("returns the current and next on-call engineer", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockRotationFindUnique.mockResolvedValue(ROTATION)
    mockMemberFindMany.mockResolvedValue([MEMBER])
    mockOverrideFindMany.mockResolvedValue([])

    const { req, res } = buildReq()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData() as any
    expect(data.current).not.toBeNull()
    expect(data.current.engineer.id).toBe("eng-a")
    expect(data.current.engineer.slackUserId).toBe("U0AAA")
    expect(typeof data.current.periodStart).toBe("string")
    // Single-member rotation → the next period is the same engineer.
    expect(data.next).not.toBeNull()
    expect(data.next.engineer.id).toBe("eng-a")
  })
})
