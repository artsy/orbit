import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    rotation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// No interactive session — the service token is the only way in here.
jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from "lib/db"
import handler from "../index.page"

const mockFindMany = prisma.rotation.findMany as jest.Mock

const TOKEN = "svc-token-abc"
const ORIGINAL = process.env.ORBIT_SERVICE_TOKENS

beforeEach(() => {
  jest.clearAllMocks()
  process.env.ORBIT_SERVICE_TOKENS = TOKEN
})

afterAll(() => {
  process.env.ORBIT_SERVICE_TOKENS = ORIGINAL
})

describe("service-token auth on /api/rotations", () => {
  it("allows a read (GET) with a valid service token", async () => {
    mockFindMany.mockResolvedValue([])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: `Bearer ${TOKEN}` },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(mockFindMany).toHaveBeenCalled()
  })

  it("rejects a write (POST) with a service token (403)", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: { name: "X", anchorDate: "2026-01-05T00:00:00.000Z" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.rotation.create).not.toHaveBeenCalled()
  })

  it("rejects an invalid token with 401", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: "Bearer wrong" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })
})
