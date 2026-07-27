# Orbit

Orbit — engineer on-call rotation scheduler.

## What it does

Orbit manages engineer on-call rotations for a team:

- A base **weekly round-robin** schedule computed from an ordered list of engineers.
- **Overrides** — one-off substitutions layered on top of the base schedule (e.g. someone is out and a teammate covers).
- **Shift swaps** — a convenience on top of overrides: two engineers trade upcoming shifts in one action.

Data is persisted in Postgres via Prisma; there is no external scheduling system.

## Stack

- **Next.js 16** (Pages Router, `.page.tsx`/`.page.ts` route files)
- **TypeScript**
- **@artsy/palette** for UI components
- **next-auth**, using Artsy/Gravity OAuth — mirrors the auth setup in [forque](https://github.com/artsy/forque)
- **Prisma + Postgres** for persistence
- **SWR** for client-side data fetching
- **Jest** (+ Testing Library, node-mocks-http) for tests

Unlike forque, Orbit deliberately drops the Relay/GraphQL layer: it owns its data directly in Postgres via Prisma, so a REST API over Prisma is enough and there's no separate gateway schema to maintain.

## Prerequisites

- Node >= 22.5
- Docker (for local Postgres)
- Yarn

## Setup

1. Install dependencies:

   ```sh
   yarn install
   ```

2. Copy the env template and fill in the blanks:

   ```sh
   cp .env.example .env.local
   ```

   - Get `CLIENT_APPLICATION_ID` / `CLIENT_APPLICATION_SECRET` from Gravity (see the link in `.env.example`).
   - Generate `NEXTAUTH_SECRET`:

     ```sh
     openssl rand -base64 32
     ```

3. Start local Postgres:

   ```sh
   yarn db:up
   ```

4. Create the database tables:

   ```sh
   yarn prisma:migrate
   ```

5. Load sample data:

   ```sh
   yarn seed
   ```

6. Run the app:

   ```sh
   yarn dev
   ```

   Then visit [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used by Prisma. |
| `CLIENT_APPLICATION_ID` | Gravity OAuth client id, used by next-auth to authenticate against Artsy. |
| `CLIENT_APPLICATION_SECRET` | Gravity OAuth client secret, paired with the id above. |
| `GRAVITY_URL` | Base URL of the Gravity API used for the OAuth handshake and user info. |
| `NEXTAUTH_URL` | Canonical URL of this app, required by next-auth. |
| `NEXTAUTH_SECRET` | Secret next-auth uses to sign/encrypt session tokens. |
| `PUBLIC_GRAVITY_URL` | Client-exposed Gravity base URL (must be prefixed `PUBLIC_` to reach the browser bundle). |

## Auth

Sign-in goes through Artsy/Gravity OAuth (next-auth). Only users whose Gravity account has the `team` role may sign in and use the app — that same role gates both reads and writes, since this is a small internal tool where any team member is trusted to add overrides and swaps. See `src/system/index.ts` for the permission table.

## Architecture

- **`src/rotations/logic`** — pure schedule computation. Given a rotation's `anchorDate`, `cadenceDays`, and ordered members, it computes the base round-robin, then layers overrides on top to produce the effective schedule. No Prisma dependency, so it's fully unit-testable in isolation.
- **`src/pages/api`** — REST API routes (Next.js Pages Router). See [`docs/api-contract.md`](docs/api-contract.md) for the full route list, request/response shapes, and error conventions.
- **`src/rotations/types.ts`** — the shared type contract (entities, request bodies, computed schedule shapes) that the logic module, API routes, and frontend all import from.
- **`src/system`** — RBAC: maps Gravity roles to domains/actions (`assertPermitted`, `isPermitted`) and is used by every write-capable API route.
- **`prisma/schema.prisma`** — the data model: `Engineer`, `Rotation`, `RotationMember` (ordered membership), and `Override` (both one-off substitutions and swap halves, linked via `swapGroupId`).

### Rotation model

The base schedule is a round-robin: given a rotation's `anchorDate` and `cadenceDays`, period `n` starts at `anchorDate + n * cadenceDays` days, and the on-call engineer for that period is `members[n % members.length]` (ordered by `position`). Overrides for a given date range replace the base assignment for any period they overlap. A **swap** is just two reciprocal `Override` rows — each engineer covering the other's shift — sharing a `swapGroupId` so the UI can display and undo them as a pair.

## Scripts

| Script | Description |
|---|---|
| `yarn dev` | Run the app in development mode. |
| `yarn build` | Build the production bundle. |
| `yarn test` | Run the Jest test suite. |
| `yarn type-check` | Run `tsc --noEmit`. |
| `yarn lint` | Run ESLint over `src`. |
| `yarn seed` | Populate the database with sample engineers, a rotation, an override, and a swap. |
| `yarn db:up` | Start local Postgres via `docker-compose`. |
| `yarn db:down` | Stop local Postgres. |
| `yarn prisma:migrate` | Apply Prisma migrations (creates/updates tables). |

## Testing

```sh
yarn test
```

Runs Jest with Testing Library. The `src/rotations/logic` module has full unit test coverage (see `src/rotations/logic/__tests__`), and API routes are tested with `node-mocks-http` to exercise request/response handling without a real server.
