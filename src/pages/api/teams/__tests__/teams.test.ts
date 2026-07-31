import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    team: {
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
import handler from "../index.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockFindMany = prisma.team.findMany as jest.Mock
const mockCreate = prisma.team.create as jest.Mock
const mockRecordEvent = prisma.event.create as jest.Mock

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

const TEAM = {
  id: "team-1",
  name: "Frontend",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/teams", () => {
  it("returns 401 when there is no session user", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it("lists teams on GET", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockFindMany.mockResolvedValue([TEAM])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData() as any
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe("team-1")
  })

  it("creates a team on POST", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockCreate.mockResolvedValue(TEAM)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Frontend" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect((res._getJSONData() as any).name).toBe("Frontend")

    expect(mockRecordEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "team.created",
        actorEmail: "ada@artsy.net",
      }),
    })
  })

  it("returns 400 when POST is missing a name", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {},
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
