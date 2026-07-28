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
import handler from "../[id]/schedule.page"

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

const ROTATION = {
  id: "rotation-1",
  name: "Weekly On-Call",
  cadenceDays: 7,
  anchorDate: new Date("2026-01-05T00:00:00.000Z"),
  timezone: "UTC",
  description: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

const ENGINEER_A = {
  id: "eng-a",
  name: "Engineer A",
  email: "a@artsy.net",
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

const MEMBER = {
  id: "member-1",
  rotationId: "rotation-1",
  engineerId: "eng-a",
  position: 0,
  engineer: ENGINEER_A,
}

function buildReq(query: Record<string, string>) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: "GET",
    query: { id: "rotation-1", ...query },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/rotations/[id]/schedule", () => {
  it("returns 401 when there is no session user", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)

    const { req, res } = buildReq({
      start: "2026-01-05T00:00:00.000Z",
      end: "2026-01-12T00:00:00.000Z",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it("returns 400 when start/end are missing", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)

    const { req, res } = buildReq({})

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
  })

  it("returns 404 when the rotation does not exist", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockRotationFindUnique.mockResolvedValue(null)

    const { req, res } = buildReq({
      start: "2026-01-05T00:00:00.000Z",
      end: "2026-01-12T00:00:00.000Z",
    })

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

  it("returns schedule entries on the happy path", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockRotationFindUnique.mockResolvedValue(ROTATION)
    mockMemberFindMany.mockResolvedValue([MEMBER])
    mockOverrideFindMany.mockResolvedValue([])

    const { req, res } = buildReq({
      start: "2026-01-05T00:00:00.000Z",
      end: "2026-01-12T00:00:00.000Z",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData() as any
    expect(data.rotation.id).toBe("rotation-1")
    expect(data.members).toHaveLength(1)
    expect(data.entries.length).toBeGreaterThan(0)
    expect(data.entries[0].baseEngineerId).toBe("eng-a")
    expect(data.entries[0].effectiveEngineerId).toBe("eng-a")
  })
})
