---
title: Architecture
---

# Architecture

Orbit mirrors Artsy's `forque` internal-tools stack, with one deliberate
difference: it owns its data, so it uses Prisma + Postgres instead of forque's
Relay/Metaphysics layer.

## Stack

- **Next.js** (Pages Router, `.page.tsx` convention), TypeScript.
- **@artsy/palette** for UI; styled-components for SSR styling; **FullCalendar** for the month on-call overview.
- **next-auth** with a custom Artsy/Gravity OAuth provider.
- **Prisma + Postgres** for persistence; **SWR** for client data fetching.
- **Jest** + Testing Library for unit tests; **Playwright** for end-to-end tests.
- **Hokusai** (Docker + Kubernetes) for deployment — see [Deployment](./deployment.md).

## Where things live

| Path | Responsibility |
|---|---|
| `src/rotations/types.ts` | The shared type contract used by every layer. |
| `src/rotations/logic/` | Pure schedule computation — round-robin, overrides, swaps. No DB/UI. Fully unit-tested. |
| `src/pages/api/` | REST endpoints (see the [API contract](./api-contract.md)), backed by Prisma. |
| `src/system/` | RBAC (`Role`, `isPermitted`, `assertPermitted`) and app boot. |
| `src/components/` | Palette UI — the schedule view and the override/swap forms. |
| `src/pages/` | Routes: home, `/rotations/[id]`, `/engineers`, `/events`. |
| `prisma/schema.prisma` | Data model: `Engineer`, `Rotation`, `RotationMember`, `Override`, `Event`. |

## The rotation model

- A `Rotation` has `cadenceDays` (7 = weekly, 14 = biweekly) and an `anchorDate`.
  The anchor includes a **handoff hour** — the rotation rolls to the next
  engineer at that time of day. `RotationMember` rows give the ordered on-call
  list (by `position`). A `Rotation` also has an optional free-text
  `description`, and its `timezone` is restricted to `Europe/Berlin`,
  `Europe/London`, or `America/New_York` (see
  [`src/rotations/timezones.ts`](../src/rotations/timezones.ts)).
- The base on-call engineer for an instant is `members[periodIndex mod memberCount]`.
  Period boundaries are computed in the rotation's **timezone** (via `@date-fns/tz`),
  so the handoff stays at the same local wall-clock hour across daylight-saving
  changes rather than drifting. Deactivated engineers are skipped.
- An `Override` replaces the base engineer for an inclusive `[startDate, endDate]`
  range. A swap is two overrides sharing a `swapGroupId`.
- The schedule is **computed on read** (`getScheduleForRange`) — overrides are
  the only mutable schedule state.
- Every mutation across the app (rotations, membership, engineers, overrides,
  swaps) is recorded as an `Event` (see [Event log](./event-log.md)).
  Deliberately **not** related to `Rotation`/`Engineer`/`Override` via a
  foreign key — those all cascade-delete, and history should survive the
  thing it describes being deleted. `Event` instead carries a denormalized
  `rotationId`/`rotationName` snapshot.

## Auth & permissions

Sign-in is Artsy/Gravity OAuth via next-auth. Reads and writes both require the
Gravity `team` role; the check lives in `src/system/index.ts` and is enforced in
each API route via `assertPermitted`. The login screen renders a button per
configured provider, so you can authenticate against a different OAuth/OIDC
provider — see
[Authenticating with a different provider](getting-started.md#authenticating-with-a-different-provider).

The sign-in gate (`signIn` callback in `[...nextauth].page.ts`) requires
exactly the `team` role — the same bar `PERMISSIONS` uses everywhere else, so
nobody can sign in only to be blocked on every subsequent action. A user
without `team` is redirected to a custom error page (`/auth/error`) showing
which account was denied and a sign-out control, rather than next-auth's
generic error screen.

Roles are captured once, at initial sign-in — a role granted (or revoked) in
Gravity afterward doesn't take effect until the user signs out and back in.

**Signing out is federated.** next-auth's `signOut()` alone only clears
Orbit's own session — Gravity has no `end_session` endpoint wired into the
custom `"artsy"` provider, so signing in again would just silently
re-authenticate the same Artsy account (Gravity has no account picker).
`src/utils/federatedSignOut.ts` clears Orbit's session, then redirects through
Gravity's `/api/v1/sessions/destroy` (a GET-able endpoint Rails' CSRF
protection doesn't guard) with a `redirect_uri` back into Orbit, so both
sessions actually end.

## Theming

The UI is built with [@artsy/palette](https://github.com/artsy/palette) and
supports **light and dark** themes. `src/system/ThemeMode.tsx` wraps the app in
palette's `Theme` and exposes a toggle (in the top nav); the choice is persisted
to `localStorage`. Because components use palette's theme-aware color tokens
(`mono0`…`mono100`, etc.), most of the UI adapts automatically.
