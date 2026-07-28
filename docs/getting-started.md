---
title: Getting started
---

# Getting started

## Prerequisites

- Node.js ≥ 22.5 (see `.nvmrc`)
- **Yarn 4**, managed by [Corepack](https://nodejs.org/api/corepack.html). Run `corepack enable` once; the repo pins the exact version via the `packageManager` field, so the right Yarn is used automatically.
- Docker (for local Postgres)

## Setup

1. **Install dependencies**

   ```sh
   yarn install
   ```

2. **Configure environment**

   Copy the example env file and fill in the blanks:

   ```sh
   cp .env.example .env.local
   ```

   You'll need:

   - `CLIENT_APPLICATION_ID` / `CLIENT_APPLICATION_SECRET` — a Gravity ClientApplication (see [Gravity API authentication](https://github.com/artsy/gravity/blob/main/doc/ApiAuthentication.md)).
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `DATABASE_URL`, `GRAVITY_URL`, `NEXTAUTH_URL`, `PUBLIC_GRAVITY_URL` — defaults for local dev are already in `.env.example`.

   The Prisma CLI (`yarn prisma:migrate`, `yarn prisma:deploy`, `yarn prisma
   generate`) only reads a plain `.env` file, not `.env.local` — that's a
   Prisma limitation, not a Next.js one. Next.js itself loads `.env.local`
   fine, so `yarn dev` doesn't need this. Keep both in sync:

   ```sh
   cp .env.local .env
   ```

3. **Start Postgres**

   ```sh
   yarn db:up      # docker-compose up -d
   ```

4. **Create the schema and seed sample data**

   ```sh
   yarn prisma:migrate   # applies migrations
   yarn seed             # 5 engineers, a weekly rotation, a demo override + swap
   ```

5. **Run the app**

   ```sh
   yarn dev
   ```

   Open <http://localhost:3000> and sign in with Artsy. Only users with the
   Gravity `team` role can sign in and make changes.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Defaults to host port 5433 (see [docker-compose.yml](../docker-compose.yml)) to avoid clashing with a system-wide Postgres on the standard 5432. |
| `CLIENT_APPLICATION_ID` | Gravity OAuth client id. |
| `CLIENT_APPLICATION_SECRET` | Gravity OAuth client secret. |
| `GRAVITY_URL` | Gravity base URL (server-side auth). |
| `NEXTAUTH_URL` | Canonical URL of this app. |
| `NEXTAUTH_SECRET` | next-auth session/JWT secret. |
| `PUBLIC_GRAVITY_URL` | Gravity URL exposed to the client. |

## Authenticating with a different provider

Orbit ships with a single **Artsy/Gravity** OAuth provider, which needs internal
Artsy credentials. If you're running your own instance (e.g. as an open-source
contributor), you can authenticate against a different provider instead of — or
alongside — Artsy. Auth is [next-auth](https://next-auth.js.org), so any
OAuth2/OIDC provider works.

**1. Add the provider** to the `providers` array in
`src/pages/api/auth/[...nextauth].page.ts`. Use a next-auth built-in (e.g.
`GithubProvider` / `GoogleProvider` from `next-auth/providers/*`) or a custom
block mirroring the Artsy one. For example, GitHub:

```ts
import GithubProvider from "next-auth/providers/github"

// inside providers: [ ... ]
GithubProvider({
  clientId: process.env.GITHUB_ID!,
  clientSecret: process.env.GITHUB_SECRET!,
  profile(profile) {
    return {
      id: String(profile.id),
      name: profile.name ?? profile.login,
      email: profile.email,
      image: profile.avatar_url,
      // See gotcha (a) below — supply a role the app recognizes.
      roles: ["team"],
    }
  },
})
```

A sign-in button for each configured provider appears on the login screen
automatically (the button list is driven by next-auth's `getProviders()`), so no
UI change is needed.

**2. Set its credentials** as environment variables and register the provider's
callback URL with it:

```
${NEXTAUTH_URL}/api/auth/callback/<provider-id>
# e.g. http://localhost:3000/api/auth/callback/github
```

**Two gotchas:**

- **(a) Roles gate everything.** The `signIn` callback only admits users whose
  `roles` include a value from the `Role` enum, and RBAC in
  `src/system/index.ts` requires the `team` role for every action. So your
  provider's `profile()` must return a recognized role (the example synthesizes
  `roles: ["team"]`). Alternatively, add a new role to the `Role` enum and grant
  it in the `PERMISSIONS` map — e.g. a read-only role listed only under
  `Action.read`.
- **(b) It's still next-auth.** `NEXTAUTH_URL` and `NEXTAUTH_SECRET` must be set
  as usual; only the `providers` array and its credentials change.

## Useful scripts

| Script | Does |
|---|---|
| `yarn dev` | Start the dev server. |
| `yarn build` | Production build. |
| `yarn test` | Jest unit test suite. |
| `yarn e2e` | Playwright end-to-end tests. |
| `yarn type-check` | `tsc --noEmit`. |
| `yarn lint` | ESLint. |
| `yarn seed` | Seed sample data. |
| `yarn db:up` / `yarn db:down` | Start / stop local Postgres. |
| `yarn prisma:migrate` | Apply migrations (dev). |

## Testing

- **Unit tests** (`yarn test`): Jest + Testing Library. The rotation logic has full coverage; API routes are tested with `node-mocks-http`.
- **End-to-end** (`yarn e2e`): Playwright drives the real UI against mocked API responses, with an injected session so it runs as a signed-in user (the auth flow itself is intentionally not e2e-tested). No database is required.

Having trouble? See [Troubleshooting](./troubleshooting.md).
