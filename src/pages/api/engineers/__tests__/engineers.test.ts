import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    engineer: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    event: {
      create: jest.fn(),
    },
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import { ENGINEER_COLORS } from "rotations/colors"
import handler from "../index.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockFindMany = prisma.engineer.findMany as jest.Mock
const mockCreate = prisma.engineer.create as jest.Mock
const mockRecordEvent = prisma.event.create as jest.Mock

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

const ENGINEER = {
  id: "eng-1",
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/engineers", () => {
  it("returns 401 when there is no session user", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it("lists engineers on GET", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockFindMany.mockResolvedValue([ENGINEER])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData() as any
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe("eng-1")
  })

  it("creates an engineer on POST", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockCreate.mockResolvedValue(ENGINEER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Ada Lovelace", email: "ada@artsy.net" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect((res._getJSONData() as any).email).toBe("ada@artsy.net")

    // Every mutation is recorded in the Event Log — see utils/api/events.ts.
    expect(mockRecordEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "engineer.created",
        actorEmail: "ada@artsy.net",
      }),
    })
  })

  it("creates an engineer with a chosen color and pattern on POST", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockCreate.mockResolvedValue({
      ...ENGINEER,
      color: "#6E56CF",
      pattern: "sparkles",
    })

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        name: "Ada Lovelace",
        email: "ada@artsy.net",
        color: "#6E56CF",
        pattern: "sparkles",
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ color: "#6E56CF", pattern: "sparkles" }),
    })
    const data = res._getJSONData() as any
    expect(data.color).toBe("#6E56CF")
    expect(data.pattern).toBe("sparkles")
  })

  it("assigns a random curated color and no pattern when POST omits both", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockCreate.mockResolvedValue(ENGINEER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Ada Lovelace", email: "ada@artsy.net" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    const createArgs = mockCreate.mock.calls[0][0]
    expect(ENGINEER_COLORS).toContain(createArgs.data.color)
    expect(createArgs.data.pattern).toBeNull()
  })

  it("respects an explicit null color (Auto) on POST", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockCreate.mockResolvedValue({ ...ENGINEER, color: null })

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Ada Lovelace", email: "ada@artsy.net", color: null },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ color: null }),
    })
  })

  it("returns 400 when POST has a color outside the curated palette", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Ada Lovelace", email: "ada@artsy.net", color: "#123456" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("returns 400 when POST has an unknown pattern", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        name: "Ada Lovelace",
        email: "ada@artsy.net",
        pattern: "confetti",
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("returns 400 when POST is missing required fields", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Missing Email" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("returns 405 for unsupported methods", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
  })
})
