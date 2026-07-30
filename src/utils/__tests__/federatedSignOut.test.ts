jest.mock("next-auth/react", () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}))

import { signOut } from "next-auth/react"
import { getENV } from "system/getENV"
import { federatedSignOut } from "../federatedSignOut"

const mockSignOut = signOut as jest.Mock
const mockGetENV = getENV as jest.Mock

describe("federatedSignOut", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetENV.mockReturnValue("https://stagingapi.artsy.net")
    // jsdom doesn't support real navigation; stub location.href as a plain
    // writable property so we can assert what it was set to.
    delete (window as any).location
    ;(window as any).location = { origin: "https://orbit-staging.artsy.net" }
  })

  it("clears Orbit's own session first, without navigating away", async () => {
    await federatedSignOut("/")

    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false })
  })

  it("then redirects through Gravity's session-destroy endpoint, back to the given path", async () => {
    await federatedSignOut("/some-page")

    expect(window.location.href).toBe(
      "https://stagingapi.artsy.net/api/v1/sessions/destroy?redirect_uri=" +
        encodeURIComponent("https://orbit-staging.artsy.net/some-page")
    )
  })

  it("defaults to the home page", async () => {
    await federatedSignOut()

    expect(window.location.href).toContain(
      encodeURIComponent("https://orbit-staging.artsy.net/")
    )
  })
})
