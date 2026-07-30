/**
 * Signs out of both Orbit and Artsy (Gravity).
 *
 * next-auth's `signOut()` alone only clears Orbit's own session — it never
 * touches Gravity's session, since the custom "artsy" OAuth provider has no
 * logout/`end_session` endpoint wired up. That meant clicking "Log out" and
 * then "Sign in" again just silently re-authenticated the same account:
 * Gravity's `/oauth2/authorize` sees the still-active Artsy session and has
 * no account picker to interrupt it.
 *
 * Gravity exposes a real (GET-able) session-destroy endpoint —
 * `/api/v1/sessions/destroy` — that Rails' CSRF protection doesn't guard
 * (it only applies to non-GET requests), and that accepts a `redirect_uri`
 * back to any `*.artsy.net`/`*.artsy.systems` host (see
 * `UrlValidation.artsy_url?` in the Gravity repo). So: clear Orbit's session
 * first, then do a full-page redirect through that endpoint to clear
 * Artsy's session too, landing back on `callbackPath`.
 */
import { signOut } from "next-auth/react"
import { getENV } from "system/getENV"

export async function federatedSignOut(callbackPath = "/") {
  await signOut({ redirect: false })

  const gravityUrl = getENV("PUBLIC_GRAVITY_URL")
  const redirectUri = `${window.location.origin}${callbackPath}`
  window.location.href = `${gravityUrl}/api/v1/sessions/destroy?redirect_uri=${encodeURIComponent(
    redirectUri
  )}`
}
