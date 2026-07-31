import { createMocks } from "node-mocks-http"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("lib/db", () => ({
  prisma: {
    team: {
      findUnique: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock("utils/auth", () => ({
  getSessionUser: jest.fn(),
}))

import { prisma } from "lib/db"
import { getSessionUser } from "utils/auth"
import handler from "../[id]/members.page"

const mockGetSessionUser = getSessionUser as jest.Mock
const mockTeamFindUnique = prisma.team.findUnique as jest.Mock
const mockMemberFindMany = prisma.teamMember.findMany as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock

const TEAM_USER = {
  name: "Ada Lovelace",
  email: "ada@artsy.net",
  accessToken: "token",
  roles: ["team"],
}

const TEAM = { id: "team-1", name: "Frontend", createdAt: new Date() }

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/teams/[id]/members", () => {
  it("returns 404 when the team doesn't exist", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockTeamFindUnique.mockResolvedValue(null)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: "nope" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(404)
  })

  it("lists a team's roster on GET", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockTeamFindUnique.mockResolvedValue(TEAM)
    mockMemberFindMany.mockResolvedValue([
      { id: "tm-1", teamId: "team-1", engineerId: "eng-1" },
    ])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: "team-1" },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect((res._getJSONData() as any)).toHaveLength(1)
  })

  it("returns 400 when PUT body isn't an engineerIds array", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockTeamFindUnique.mockResolvedValue(TEAM)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      query: { id: "team-1" },
      body: {},
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("replaces the roster on PUT", async () => {
    mockGetSessionUser.mockResolvedValue(TEAM_USER)
    mockTeamFindUnique.mockResolvedValue(TEAM)
    mockTransaction.mockResolvedValue([
      { id: "tm-1", teamId: "team-1", engineerId: "eng-1" },
      { id: "tm-2", teamId: "team-1", engineerId: "eng-2" },
    ])

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      query: { id: "team-1" },
      body: { engineerIds: ["eng-1", "eng-2"] },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(mockTransaction).toHaveBeenCalled()
    expect((res._getJSONData() as any)).toHaveLength(2)
  })
})
