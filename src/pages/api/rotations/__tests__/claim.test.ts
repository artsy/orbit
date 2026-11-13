import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import handler from "../[id]/claim.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock

const mockQueryRaw = jest.fn()
const mockRotationFindUnique = jest.fn()
const mockRotationUpdate = jest.fn()
const mockMemberFindMany = jest.fn()
const mockOverrideFindMany = jest.fn()
const mockEventCreate = jest.fn()

const tx = {
  $queryRaw: mockQueryRaw,
  rotation: { findUnique: mockRotationFindUnique, update: mockRotationUpdate },
  rotationMember: { findMany: mockMemberFindMany },
  override: { findMany: mockOverrideFindMany },
  event: { create: mockEventCreate },
}

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

const ROTATION = {
  id: "rotation-1",
  name: "Security bounty",
  cadenceDays: 7,
  anchorDate: new Date("2020-01-06T00:00:00.000Z"),
  timezone: "UTC",
  description: null,
  kind: "turn",
  nextPosition: 1,
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
}

const engineer = (id: string, name: string, active = true) => ({
  id,
  name,
  email: `${id}@artsy.net`,
  slackUserId: null,
  active,
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
})

const ENGINEER_A = engineer("eng-a", "Engineer A")
const ENGINEER_B = engineer("eng-b", "Engineer B")
const ENGINEER_C = engineer("eng-c", "Engineer C")

const member = (position: number, eng: ReturnType<typeof engineer>) => ({
  id: `member-${position}`,
  rotationId: "rotation-1",
  engineerId: eng.id,
  position,
  engineer: eng,
})

const MEMBERS = [member(0, ENGINEER_A), member(1, ENGINEER_B)]

const buildReq = (
  options: { method?: "POST" | "GET"; body?: Record<string, unknown> } = {}
) =>
  createMocks<NextApiRequest, NextApiResponse>({
    method: options.method ?? "POST",
    query: { id: "rotation-1" },
    body: options.body ?? {},
  })

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSessionUser.mockResolvedValue(TEAM_USER)
  mockTransaction.mockImplementation((callback) => callback(tx))
  mockQueryRaw.mockResolvedValue([{ id: "rotation-1" }])
  mockRotationFindUnique.mockResolvedValue(ROTATION)
  mockMemberFindMany.mockResolvedValue(MEMBERS)
  mockOverrideFindMany.mockResolvedValue([])
})

describe("/api/rotations/[id]/claim", () => {
  it("returns 401 without a user", async () => {
    mockGetSessionUser.mockResolvedValue(undefined)
    const { req, res } = buildReq()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(401)
  })

  it("returns 405 for GET", async () => {
    const { req, res } = buildReq({ method: "GET" })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })

  it("returns 404 when the rotation is missing", async () => {
    mockRotationFindUnique.mockResolvedValue(null)
    const { req, res } = buildReq()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(404)
    expect(mockRotationUpdate).not.toHaveBeenCalled()
  })

  it("returns 400 when the rotation is scheduled", async () => {
    mockRotationFindUnique.mockResolvedValue({
      ...ROTATION,
      kind: "scheduled",
    })
    const { req, res } = buildReq()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
    expect(mockRotationUpdate).not.toHaveBeenCalled()
  })

  it("returns 409 when no member is active", async () => {
    mockMemberFindMany.mockResolvedValue([
      member(0, engineer("eng-a", "Engineer A", false)),
    ])
    const { req, res } = buildReq()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(409)
    expect(mockRotationUpdate).not.toHaveBeenCalled()
  })

  it("returns the picked engineer and saves the new nextPosition", async () => {
    const { req, res } = buildReq()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect((res._getJSONData() as any).engineer.id).toBe("eng-b")
    expect(mockRotationUpdate).toHaveBeenCalledWith({
      where: { id: "rotation-1" },
      data: { nextPosition: 2 },
    })
  })

  it("returns the override replacement even when they are not a member", async () => {
    mockOverrideFindMany.mockResolvedValue([
      {
        id: "override-1",
        rotationId: "rotation-1",
        startDate: new Date("2000-01-01T00:00:00.000Z"),
        endDate: new Date("2100-01-01T00:00:00.000Z"),
        replacementEngineerId: "eng-c",
        originalEngineerId: "eng-b",
        reason: null,
        createdByEmail: "ada@artsy.net",
        swapGroupId: null,
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
        replacementEngineer: ENGINEER_C,
      },
    ])

    const { req, res } = buildReq()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect((res._getJSONData() as any).engineer.id).toBe("eng-c")
    expect(mockRotationUpdate).toHaveBeenCalledWith({
      where: { id: "rotation-1" },
      data: { nextPosition: 2 },
    })
  })

  it("locks the rotation row before reading it", async () => {
    const { req, res } = buildReq()
    await handler(req, res)

    expect(mockQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockRotationFindUnique.mock.invocationCallOrder[0]
    )
    expect(String(mockQueryRaw.mock.calls[0][0])).toContain("FOR UPDATE")
  })

  it("records rotation.turn_claimed with the reference in the summary", async () => {
    const { req, res } = buildReq({ body: { reference: "GF740" } })
    await handler(req, res)

    expect(mockEventCreate).toHaveBeenCalledTimes(1)
    const { data } = mockEventCreate.mock.calls[0][0]
    expect(data).toMatchObject({
      action: "rotation.turn_claimed",
      actorEmail: "ada@artsy.net",
      rotationId: "rotation-1",
      rotationName: "Security bounty",
    })
    expect(data.summary).toBe(
      'Assigned turn to Engineer B on "Security bounty" (GF740)'
    )
  })

  it("omits the reference from the summary when none is sent", async () => {
    const { req, res } = buildReq()
    await handler(req, res)

    const { data } = mockEventCreate.mock.calls[0][0]
    expect(data.summary).toBe(
      'Assigned turn to Engineer B on "Security bounty"'
    )
  })
})
