import type { NextApiRequest } from "next"
import { getServiceUser } from "utils/serviceAuth"
import { Role } from "system"

const reqWith = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} } as NextApiRequest)

const ORIGINAL = process.env.ORBIT_SERVICE_TOKENS

afterEach(() => {
  process.env.ORBIT_SERVICE_TOKENS = ORIGINAL
})

describe("getServiceUser", () => {
  it("returns undefined when no tokens are configured", () => {
    delete process.env.ORBIT_SERVICE_TOKENS
    expect(getServiceUser(reqWith("Bearer anything"))).toBeUndefined()
  })

  it("returns undefined when the Authorization header is missing", () => {
    process.env.ORBIT_SERVICE_TOKENS = "tok-1"
    expect(getServiceUser(reqWith())).toBeUndefined()
  })

  it("returns undefined for a non-matching token", () => {
    process.env.ORBIT_SERVICE_TOKENS = "tok-1,tok-2"
    expect(getServiceUser(reqWith("Bearer nope"))).toBeUndefined()
  })

  it("returns a read-only service user for a matching token", () => {
    process.env.ORBIT_SERVICE_TOKENS = "tok-1, tok-2"
    const user = getServiceUser(reqWith("Bearer tok-2"))
    expect(user).toBeDefined()
    expect(user?.roles).toEqual([Role.service])
  })
})
