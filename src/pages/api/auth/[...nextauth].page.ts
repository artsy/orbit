import NextAuth, { type NextAuthOptions } from "next-auth"
import { Role } from "system"

export const authOptions: NextAuthOptions = {
  // Custom error page so a rejected sign-in shows which account was denied
  // and how to fix it, instead of next-auth's generic "Access Denied" screen.
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    // Only Gravity `team` role holders may use Orbit — this must match
    // exactly what PERMISSIONS in `system/index.ts` grants access to.
    // Previously this admitted anyone with *any* recognized Role value
    // (including `product_development`), which every PERMISSIONS domain
    // only ever grants to `team`/`service` — so someone with just
    // `product_development` could sign in, then get blocked on every single
    // action with no explanation.
    signIn: async ({ profile }) => {
      // @ts-expect-error
      const userRoles = (profile?.roles as string[]) || []
      if (userRoles.includes(Role.team)) return true

      // Returning a string (rather than `false`) redirects the browser there
      // directly, letting us pass along which email was denied.
      const email = profile?.email ?? ""
      return `/auth/error?error=AccessDenied&email=${encodeURIComponent(email)}`
    },
    jwt: async ({ token, user, account }) => {
      if (account) {
        token.access_token = account.access_token
        token.roles = user?.roles
      }
      return token
    },
    session: async ({ session, token }) => {
      // @ts-ignore
      session.user.accessToken = token.access_token
      // @ts-ignore
      session.user.roles = token.roles || []
      // @ts-ignore
      session.user.id = token.sub
      return session
    },
  },
  providers: [
    {
      id: "artsy",
      clientId: process.env.CLIENT_APPLICATION_ID,
      clientSecret: process.env.CLIENT_APPLICATION_SECRET,
      name: "Artsy",
      type: "oauth",
      authorization: `${process.env.GRAVITY_URL}/oauth2/authorize`,
      token: {
        url: `${process.env.GRAVITY_URL}/oauth2/access_token?on_success=200`,
        params: { on_success: 200 },
      },
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      userinfo: {
        url: `${process.env.GRAVITY_URL}/api/v1/me`,
        async request(context) {
          const response = await fetch(`${process.env.GRAVITY_URL}/api/v1/me`, {
            headers: {
              // Gravity expects its own header, not `Authorization: Bearer ...`
              "X-Access-Token": context.tokens.access_token,
            } as HeadersInit,
          })
          return await response.json()
        },
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          roles: profile.roles,
        }
      },
    },
  ],
}

export default NextAuth(authOptions)
