import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    rotation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    rotationMember: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    override: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    event: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}))

// No interactive session — the service token is the only way in here.
jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from "lib/db"
import handler from "../index.page"
import claimHandler from "../[id]/claim.page"
import membersHandler from "../[id]/members.page"
import overridesHandler from "../[id]/overrides.page"

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

  it("allows claiming a turn with a service token", async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback(prisma)
    )
    ;(prisma.rotation.findUnique as jest.Mock).mockResolvedValue({
      id: "rotation-1",
      name: "Security bounty",
      timezone: "UTC",
      kind: "turn",
      nextPosition: 0,
    })
    ;(prisma.rotationMember.findMany as jest.Mock).mockResolvedValue([
      {
        id: "member-1",
        rotationId: "rotation-1",
        engineerId: "eng-a",
        position: 0,
        engineer: {
          id: "eng-a",
          name: "Engineer A",
          email: "a@artsy.net",
          slackUserId: null,
          active: true,
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      },
    ])
    ;(prisma.override.findMany as jest.Mock).mockResolvedValue([])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { id: "rotation-1" },
      headers: { authorization: `Bearer ${TOKEN}` },
      body: { reference: "GF740" },
    })

    await claimHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect((res._getJSONData() as any).engineer.id).toBe("eng-a")
  })

  it("rejects replacing members with a service token (403)", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      query: { id: "rotation-1" },
      headers: { authorization: `Bearer ${TOKEN}` },
      body: { engineerIds: ["eng-a"] },
    })

    await membersHandler(req, res)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.rotationMember.createMany).not.toHaveBeenCalled()
  })

  it("rejects creating an override with a service token (403)", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { id: "rotation-1" },
      headers: { authorization: `Bearer ${TOKEN}` },
      body: {
        startDate: "2026-01-05T00:00:00.000Z",
        endDate: "2026-01-06T00:00:00.000Z",
        replacementEngineerId: "eng-b",
      },
    })

    await overridesHandler(req, res)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.override.create).not.toHaveBeenCalled()
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
