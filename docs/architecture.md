---
layout: default
title: Architecture
---

# Architecture

[← Back to home](index.html)

Orbit mirrors Artsy's `forque` internal-tools stack, with one deliberate
difference: it owns its data, so it uses Prisma + Postgres instead of forque's
Relay/Metaphysics layer.

## Stack

- **Next.js** (Pages Router, `.page.tsx` convention), TypeScript.
- **@artsy/palette** for UI; styled-components for SSR styling.
- **next-auth** with a custom Artsy/Gravity OAuth provider.
- **Prisma + Postgres** for persistence; **SWR** for client data fetching.
- **Jest** + Testing Library for tests.

## Where things live

| Path | Responsibility |
|---|---|
| `src/rotations/types.ts` | The shared type contract used by every layer. |
| `src/rotations/logic/` | Pure schedule computation — round-robin, overrides, swaps. No DB/UI. Fully unit-tested. |
| `src/pages/api/` | REST endpoints (see the [API contract](api-contract.html)), backed by Prisma. |
| `src/system/` | RBAC (`Role`, `isPermitted`, `assertPermitted`) and app boot. |
| `src/components/` | Palette UI — the schedule view and the override/swap forms. |
| `src/pages/` | Routes: home, `/rotations/[id]`, `/engineers`. |
| `prisma/schema.prisma` | Data model: `Engineer`, `Rotation`, `RotationMember`, `Override`. |

## The rotation model

- A `Rotation` has `cadenceDays` and an `anchorDate`. `RotationMember` rows give
  the ordered on-call list (by `position`).
- The base on-call engineer for a date is computed:
  `members[floor(daysSinceAnchor / cadenceDays) mod memberCount]`.
- An `Override` replaces the base engineer for an inclusive `[startDate, endDate]`
  range. A swap is two overrides sharing a `swapGroupId`.
- The schedule is **computed on read** (`getScheduleForRange`) — overrides are
  the only mutable schedule state.

## Auth & permissions

Sign-in is Artsy/Gravity OAuth via next-auth. Reads and writes both require the
Gravity `team` role; the check lives in `src/system/index.ts` and is enforced in
each API route via `assertPermitted`.
