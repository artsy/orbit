import { encode } from "next-auth/jwt"
import { mkdirSync, writeFileSync } from "fs"
import path from "path"
import { NEXTAUTH_SECRET } from "./constants"

/**
 * Signs a next-auth session token and writes it into a Playwright storage
 * state, so every test runs as an authenticated `team` user WITHOUT going
 * through the real Artsy/Gravity OAuth flow (we don't e2e-test auth itself).
 */
export default async function globalSetup() {
  const token = await encode({
    secret: NEXTAUTH_SECRET,
    token: {
      name: "Test User",
      email: "test@artsymail.com",
      sub: "e2e-user",
      access_token: "e2e-access-token",
      roles: ["team"],
    },
  })

  const state = {
    cookies: [
      {
        name: "next-auth.session-token",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      },
    ],
    origins: [],
  }

  const dir = path.join(__dirname, ".auth")
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2))
}
