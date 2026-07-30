import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import handler from "../index.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockFindMany = prisma.event.findMany as jest.Mock

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

const EVENT = {
  id: "evt-1",
  action: "rotation.created",
  summary: 'Created rotation "Platform on-call"',
  actorEmail: "ada@artsy.net",
  rotationId: "rot-1",
  rotationName: "Platform on-call",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

const TOKEN = "svc-token-abc"
const ORIGINAL_TOKENS = process.env.ORBIT_SERVICE_TOKENS

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.ORBIT_SERVICE_TOKENS
})

afterAll(() => {
  process.env.ORBIT_SERVICE_TOKENS = ORIGINAL_TOKENS
})

describe("/api/events", () => {
  it("returns 401 when there is no session user or service token", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it("lists events on GET, newest first", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockFindMany.mockResolvedValue([EVENT])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData() as any
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe("evt-1")
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    )
  })

  it("filters by rotationId when provided", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockFindMany.mockResolvedValue([])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { rotationId: "rot-1" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rotationId: "rot-1" } })
    )
  })

  it("allows a read with a valid service token (read-only role)", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)
    mockFindMany.mockResolvedValue([])
    process.env.ORBIT_SERVICE_TOKENS = TOKEN

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: `Bearer ${TOKEN}` },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
  })

  it("returns 405 for unsupported methods", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
  })
})
