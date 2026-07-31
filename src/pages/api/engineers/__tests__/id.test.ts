import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    engineer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    event: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import handler from "../[id].page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockFindUnique = prisma.engineer.findUnique as jest.Mock
const mockUpdate = prisma.engineer.update as jest.Mock
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
  slackUserId: null,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/engineers/[id]", () => {
  it("returns 401 when there is no session user", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      query: { id: "eng-1" },
      body: { name: "New Name" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it("returns 403 when the user lacks the team role", async () => {
    mockGetSessionUser.mockResolvedValue({ ...TEAM_USER, roles: [] })

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      query: { id: "eng-1" },
      body: { name: "New Name" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns 404 when the engineer doesn't exist", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockFindUnique.mockResolvedValue(null)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      query: { id: "nope" },
      body: { name: "New Name" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(404)
  })

  it("applies a partial update on PATCH and records an event", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockFindUnique.mockResolvedValue(ENGINEER)
    mockUpdate.mockResolvedValue({
      ...ENGINEER,
      name: "Ada K. Lovelace",
      slackUserId: "U123",
      active: false,
    })

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      query: { id: "eng-1" },
      body: { name: "Ada K. Lovelace", slackUserId: "U123", active: false },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "eng-1" },
      data: { name: "Ada K. Lovelace", slackUserId: "U123", active: false },
    })

    const data = res._getJSONData() as any
    expect(data.name).toBe("Ada K. Lovelace")
    expect(data.active).toBe(false)

    expect(mockRecordEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "engineer.updated",
        actorEmail: "ada@artsy.net",
      }),
    })
  })
})
