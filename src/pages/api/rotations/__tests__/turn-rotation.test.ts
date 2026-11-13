import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    rotation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    rotationMember: {
      findMany: jest.fn(),
    },
    override: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    event: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import rotationsHandler from "../index.page"
import rotationHandler from "../[id]/index.page"
import swapsHandler from "../[id]/swaps.page"
import overridesHandler from "../[id]/overrides.page"
import membersHandler from "../[id]/members.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockRotationFindUnique = prisma.rotation.findUnique as jest.Mock
const mockRotationCreate = prisma.rotation.create as jest.Mock
const mockRotationUpdate = prisma.rotation.update as jest.Mock
const mockOverrideCreate = prisma.override.create as jest.Mock
const mockMemberFindMany = prisma.rotationMember.findMany as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock

const mockQueryRaw = jest.fn()
const mockTxRotationFindUnique = jest.fn()
const mockTxRotationUpdate = jest.fn()
const mockTxMemberFindMany = jest.fn()
const mockTxMemberDeleteMany = jest.fn()
const mockTxMemberCreateMany = jest.fn()
const mockTxEventCreate = jest.fn()

const tx = {
  $queryRaw: mockQueryRaw,
  rotation: {
    findUnique: mockTxRotationFindUnique,
    update: mockTxRotationUpdate,
  },
  rotationMember: {
    findMany: mockTxMemberFindMany,
    deleteMany: mockTxMemberDeleteMany,
    createMany: mockTxMemberCreateMany,
  },
  event: { create: mockTxEventCreate },
}

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

const SCHEDULED = {
  id: "rotation-1",
  name: "Weekly On-Call",
  cadenceDays: 7,
  anchorDate: new Date("2026-01-05T00:00:00.000Z"),
  timezone: "UTC",
  description: null,
  kind: "scheduled",
  nextPosition: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

const TURN = { ...SCHEDULED, name: "Security bounty", kind: "turn" }

const engineer = (id: string) => ({
  id,
  name: `Engineer ${id}`,
  email: `${id}@artsy.net`,
  slackUserId: null,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
})

const member = (position: number, id: string) => ({
  id: `member-${position}`,
  rotationId: "rotation-1",
  engineerId: id,
  position,
  engineer: engineer(id),
})

const call = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>,
  method: "POST" | "PATCH" | "PUT",
  body: Record<string, unknown>,
  query: Record<string, string> = { id: "rotation-1" }
) => {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method,
    query,
    body,
  })
  return handler(req, res).then(() => res)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSessionUser.mockResolvedValue(TEAM_USER)
  mockTransaction.mockImplementation((callback) => callback(tx))
  mockQueryRaw.mockResolvedValue([{ id: "rotation-1" }])
  mockRotationCreate.mockImplementation(({ data }) =>
    Promise.resolve({ ...SCHEDULED, ...data })
  )
  mockRotationUpdate.mockImplementation(({ data }) =>
    Promise.resolve({ ...SCHEDULED, ...data })
  )
})

describe("POST /api/rotations", () => {
  it("creates a turn rotation with anchorDate = now when none is given", async () => {
    const before = Date.now()
    const res = await call(rotationsHandler, "POST", {
      name: "Security bounty",
      kind: "turn",
    })
    const after = Date.now()

    expect(res._getStatusCode()).toBe(201)
    const { data } = mockRotationCreate.mock.calls[0][0]
    expect(data).toMatchObject({ kind: "turn", cadenceDays: 7 })
    expect(data.anchorDate.getTime()).toBeGreaterThanOrEqual(before)
    expect(data.anchorDate.getTime()).toBeLessThanOrEqual(after)
  })

  it("keeps a given anchorDate on a turn rotation", async () => {
    await call(rotationsHandler, "POST", {
      name: "Security bounty",
      kind: "turn",
      anchorDate: "2026-02-02T00:00:00.000Z",
    })

    const { data } = mockRotationCreate.mock.calls[0][0]
    expect(data.anchorDate.toISOString()).toBe("2026-02-02T00:00:00.000Z")
  })

  it("defaults to a scheduled rotation", async () => {
    await call(rotationsHandler, "POST", {
      name: "Weekly On-Call",
      anchorDate: "2026-01-05T00:00:00.000Z",
    })

    expect(mockRotationCreate.mock.calls[0][0].data.kind).toBe("scheduled")
  })

  it("still requires anchorDate for a scheduled rotation", async () => {
    const res = await call(rotationsHandler, "POST", {
      name: "Weekly On-Call",
      kind: "scheduled",
    })

    expect(res._getStatusCode()).toBe(400)
    expect(mockRotationCreate).not.toHaveBeenCalled()
  })

  it("rejects an unknown kind with 400", async () => {
    const res = await call(rotationsHandler, "POST", {
      name: "Weekly On-Call",
      kind: "bogus",
      anchorDate: "2026-01-05T00:00:00.000Z",
    })

    expect(res._getStatusCode()).toBe(400)
    expect(mockRotationCreate).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/rotations/[id]", () => {
  it("ignores kind in the body", async () => {
    mockRotationFindUnique.mockResolvedValue(SCHEDULED)

    const res = await call(rotationHandler, "PATCH", {
      name: "Renamed",
      kind: "turn",
    })

    expect(res._getStatusCode()).toBe(200)
    const { data } = mockRotationUpdate.mock.calls[0][0]
    expect(data).toEqual({ name: "Renamed" })
  })
})

describe("POST /api/rotations/[id]/swaps", () => {
  it("returns 400 for a turn rotation", async () => {
    mockRotationFindUnique.mockResolvedValue(TURN)

    const res = await call(swapsHandler, "POST", {
      engineerAId: "eng-a",
      engineerBId: "eng-b",
      dateA: "2026-01-05T00:00:00.000Z",
      dateB: "2026-01-12T00:00:00.000Z",
    })

    expect(res._getStatusCode()).toBe(400)
    expect((res._getJSONData() as any).error).toBe(
      "turn-based rotation has no swaps"
    )
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

describe("POST /api/rotations/[id]/overrides", () => {
  const body = {
    startDate: "2026-01-05T00:00:00.000Z",
    endDate: "2026-01-11T00:00:00.000Z",
    replacementEngineerId: "eng-b",
  }

  beforeEach(() => {
    mockOverrideCreate.mockResolvedValue({
      id: "override-1",
      rotationId: "rotation-1",
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      replacementEngineerId: "eng-b",
      originalEngineerId: null,
      reason: null,
      createdByEmail: "ada@artsy.net",
      swapGroupId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      replacementEngineer: engineer("eng-b"),
    })
  })

  it("requires originalEngineerId on a turn rotation", async () => {
    mockRotationFindUnique.mockResolvedValue(TURN)

    const res = await call(overridesHandler, "POST", body)

    expect(res._getStatusCode()).toBe(400)
    expect((res._getJSONData() as any).error).toBe(
      "originalEngineerId is required for turn-based rotations"
    )
    expect(mockOverrideCreate).not.toHaveBeenCalled()
  })

  it("accepts originalEngineerId on a turn rotation", async () => {
    mockRotationFindUnique.mockResolvedValue(TURN)
    mockMemberFindMany.mockResolvedValue([member(0, "eng-a")])

    const res = await call(overridesHandler, "POST", {
      ...body,
      originalEngineerId: "eng-a",
    })

    expect(res._getStatusCode()).toBe(201)
    expect(mockOverrideCreate.mock.calls[0][0].data.originalEngineerId).toBe(
      "eng-a"
    )
  })

  it("rejects an originalEngineerId that is not a member of the turn rotation", async () => {
    mockRotationFindUnique.mockResolvedValue(TURN)
    mockMemberFindMany.mockResolvedValue([member(0, "eng-a")])

    const res = await call(overridesHandler, "POST", {
      ...body,
      originalEngineerId: "eng-z",
    })

    expect(res._getStatusCode()).toBe(400)
    expect((res._getJSONData() as any).error).toBe(
      "originalEngineerId must be a member of this rotation"
    )
    expect(mockOverrideCreate).not.toHaveBeenCalled()
  })

  it("rejects a replacement who is the engineer being covered", async () => {
    mockRotationFindUnique.mockResolvedValue(TURN)
    mockMemberFindMany.mockResolvedValue([member(0, "eng-b")])

    const res = await call(overridesHandler, "POST", {
      ...body,
      originalEngineerId: "eng-b",
    })

    expect(res._getStatusCode()).toBe(400)
    expect((res._getJSONData() as any).error).toBe(
      "replacement must differ from the engineer being covered"
    )
    expect(mockOverrideCreate).not.toHaveBeenCalled()
  })

  it("still works without originalEngineerId on a scheduled rotation", async () => {
    mockRotationFindUnique.mockResolvedValue(SCHEDULED)

    const res = await call(overridesHandler, "POST", body)

    expect(res._getStatusCode()).toBe(201)
  })
})

describe("PUT /api/rotations/[id]/members", () => {
  beforeEach(() => {
    mockTxMemberFindMany.mockResolvedValue([])
  })

  it("on a turn rotation locks the row, re-reads nextPosition and carries it over", async () => {
    mockRotationFindUnique.mockResolvedValue({ ...TURN, nextPosition: 0 })
    mockTxRotationFindUnique.mockResolvedValue({ ...TURN, nextPosition: 1 })
    const oldMembers = [member(0, "eng-a"), member(1, "eng-b")]
    mockTxMemberFindMany.mockResolvedValueOnce(oldMembers)

    const res = await call(membersHandler, "PUT", {
      engineerIds: ["eng-c", "eng-b", "eng-a"],
    })

    expect(res._getStatusCode()).toBe(200)
    expect(mockQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockTxRotationFindUnique.mock.invocationCallOrder[0]
    )
    expect(String(mockQueryRaw.mock.calls[0][0])).toContain("FOR UPDATE")
    expect(mockTxMemberFindMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockTxMemberDeleteMany.mock.invocationCallOrder[0]
    )
    expect(mockTxRotationUpdate).toHaveBeenCalledWith({
      where: { id: "rotation-1" },
      data: { nextPosition: 1 },
    })
  })

  it("on a scheduled rotation does not touch nextPosition", async () => {
    mockRotationFindUnique.mockResolvedValue(SCHEDULED)

    const res = await call(membersHandler, "PUT", {
      engineerIds: ["eng-a", "eng-b"],
    })

    expect(res._getStatusCode()).toBe(200)
    expect(mockQueryRaw).not.toHaveBeenCalled()
    expect(mockTxRotationUpdate).not.toHaveBeenCalled()
    expect(mockTxMemberCreateMany).toHaveBeenCalled()
  })
})
