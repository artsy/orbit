---
title: API contract
---

# Orbit API contract

All routes live under `/api` (Next.js Pages Router API routes, file suffix
`.page.ts`). All requests require a valid next-auth session. **Write** actions
(POST/PUT/PATCH/DELETE) additionally require the `team` role via
`assertPermitted(user, domain, Action.manage)`.

Request/response types are defined in [`src/rotations/types.ts`](../src/rotations/types.ts).
All dates crossing the boundary are ISO 8601 strings.

On authorization failure return `403 { error }`; on validation failure `400 { error }`;
on missing resource `404 { error }`.

## Engineers — domain `engineers`

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/engineers` | — | `Engineer[]` |
| POST | `/api/engineers` | `CreateEngineerBody` | `Engineer` (201) |
| PATCH | `/api/engineers/[id]` | `UpdateEngineerBody` | `Engineer` |
| DELETE | `/api/engineers/[id]` | — | `Engineer` (hard-deletes; also removes their memberships and covering overrides) |

An `Engineer` has an optional `slackUserId` (the Slack user ID, for bot
`@mentions` — stable across handle changes) and an `active` flag (inactive
engineers are skipped when computing a rotation's schedule); `CreateEngineerBody`
/ `UpdateEngineerBody` accept both. `PATCH` applies a partial update — only the
fields present in the body change.

## Rotations — domain `rotations`

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/rotations` | — | `Rotation[]` |
| POST | `/api/rotations` | `CreateRotationBody` | `Rotation` (201) |
| GET | `/api/rotations/[id]` | — | `Rotation` |
| PATCH | `/api/rotations/[id]` | `UpdateRotationBody` | `Rotation` |
| DELETE | `/api/rotations/[id]` | — | `Rotation` |
| GET | `/api/rotations/[id]/on-call` | — | `OnCallResponse` |
| POST | `/api/rotations/[id]/claim` | `ClaimTurnBody` | `ClaimTurnResponse` |

`GET /api/rotations/[id]/on-call` is a convenience view of **who's on call now
and next** (overrides/swaps applied), so callers don't have to fetch the full
schedule and do the date math. `OnCallResponse` is
`{ current: OnCallSlot | null, next: OnCallSlot | null }`, where `OnCallSlot` is
`{ engineer: Engineer | null, periodStart, periodEnd }` (ISO dates).

`POST /api/rotations/[id]/claim` hands the next turn of a `turn` rotation to the
next active member in order and advances `nextPosition`. It needs the `claim`
action (`Action.claim`), which both `team` and `service` hold. If an override
for that member covers today (in the rotation's timezone), the replacement is
returned instead. `ClaimTurnBody` is `{ reference?: string }`, a free-text label
such as a ticket id that goes into the Event Log summary. `ClaimTurnResponse` is
`{ engineer: Engineer }`. Returns `400` for a `scheduled` rotation and `409`
when no member is active. The rotation row is locked for the duration, so
concurrent claims never pick the same engineer.

`POST /api/rotations` takes an optional `kind` of `scheduled` (the default) or
`turn`; any other value returns `400`. `anchorDate` is required for `scheduled`
rotations. A `turn` rotation created without one stores `anchorDate` as the
creation time. `kind` cannot change after creation, so `PATCH` ignores it.

A `turn` rotation has no schedule. These endpoints return `400` for one:

| Route | Error |
|---|---|
| `GET /api/rotations/[id]/on-call` | `turn-based rotation has no schedule` |
| `GET /api/rotations/[id]/schedule` | `turn-based rotation has no schedule` |
| `POST /api/rotations/[id]/swaps` | `turn-based rotation has no swaps` |

`POST /api/rotations/[id]/overrides` on a `turn` rotation requires
`originalEngineerId` and returns `400` with
`originalEngineerId is required for turn-based rotations` without it.

A `Rotation` includes an optional `description` (string, nullable) — free-text
notes on the rotation's purpose. Both `CreateRotationBody` and
`UpdateRotationBody` accept an optional `description`.

`timezone` (on create and update) must be one of `Europe/Berlin`,
`Europe/London`, or `America/New_York`; any other value returns `400`.

## Membership — domain `rotations`

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/rotations/[id]/members` | — | `RotationMember[]` (ordered by `position`, `engineer` populated) |
| PUT | `/api/rotations/[id]/members` | `SetMembersBody` | `RotationMember[]` (replaces full ordered membership) |

On a `turn` rotation, `PUT` locks the rotation row and moves `nextPosition` so
the engineer who was next up keeps the turn (or the nearest later member does).

## Schedule — domain `rotations`

| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/rotations/[id]/schedule` | `start`, `end` (ISO dates) | `ScheduleResponse` |

The `/schedule` handler loads the rotation, its ordered members, and overlapping
overrides, then delegates to the pure logic module (`src/rotations/logic`) to
compute `entries`.

## Overrides — domain `overrides`

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/rotations/[id]/overrides` | — | `Override[]` |
| POST | `/api/rotations/[id]/overrides` | `CreateOverrideBody` | `Override` (201) |
| PATCH | `/api/overrides/[id]` | `UpdateOverrideBody` | `Override` |
| DELETE | `/api/overrides/[id]` | — | `Override` |

`UpdateOverrideBody` accepts any of `startDate`, `endDate`,
`replacementEngineerId`, `reason` — only the provided fields change.

## Swaps — domain `overrides`

| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/rotations/[id]/swaps` | `CreateSwapBody` | `Override[]` (the two reciprocal overrides, sharing a `swapGroupId`) (201) |

The `/swaps` handler loads the rotation's existing overrides and passes them
to `buildSwap` from the logic module, which validates `engineerAId` /
`engineerBId` against who is **effectively** on call for `dateA` / `dateB` —
the schedule with any existing overrides/swaps applied, not just the base
round-robin. `buildSwap` returns `400` (via `sendError`) when:

- `engineerAId` (or `engineerBId`) is not the effective on-call engineer for
  `dateA` (or `dateB`),
- `engineerAId` and `engineerBId` are the same engineer, or
- `dateA` and `dateB` fall in the same period.

On success it generates a shared `swapGroupId` and persists both new override
rows in a transaction; it never deletes or modifies an existing override, so
swaps stack as independent layers and `applyOverrides`' latest-`createdAt`-wins
rule resolves each period. `originalEngineerId` on each new row is the
effective engineer giving up that shift. Deleting the most recent swap in a
chain rolls the affected periods back exactly one step, to the swap
underneath it.

## Teams — domain `teams`

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/teams` | — | `Team[]` |
| POST | `/api/teams` | `CreateTeamBody` | `Team` (201) |
| GET | `/api/teams/[id]` | — | `Team` |
| PATCH | `/api/teams/[id]` | `UpdateTeamBody` | `Team` |
| DELETE | `/api/teams/[id]` | — | `Team` (also removes its roster) |
| GET | `/api/teams/[id]/members` | — | `TeamMember[]` (`engineer` populated) |
| PUT | `/api/teams/[id]/members` | `SetTeamMembersBody` | `TeamMember[]` (replaces the full, unordered roster) |

A `Team` is independent of any `Rotation` — it's purely a convenience for
bulk-adding its roster to a rotation's membership (see
[Teams](./teams.md#add-a-full-team-to-a-rotation)). There's no dedicated
endpoint for that; the client merges a team's `engineerId`s into a rotation's
existing membership and calls the same
`PUT /api/rotations/[id]/members` described above.

## Event log — domain `events`

| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/events` | `rotationId` (optional), `limit` (optional, default 200, max 1000) | `EventLogEntry[]`, newest first |

Read-only — there's no `manage` action for this domain, and nothing writes to
it directly. Every mutating endpoint above (rotations, membership, engineers,
overrides, swaps) records an `EventLogEntry` as a side effect of its write, via
the shared `recordEvent` helper in `src/utils/api/events.ts`. See
[Event log](./event-log.md) for the full list of recorded actions.

An `EventLogEntry` has no live relation to the rotation it references —
`rotationId`/`rotationName` are a denormalized snapshot, so entries persist
even after the rotation itself is deleted (`rotationId` is `null` in that
case).

## Health

| Method | Route | Response |
|---|---|---|
| GET | `/api/status` | `{ status: "OK" }` |

## Authentication

Most endpoints require an authenticated caller. There are two ways to
authenticate:

1. **Interactive session** (people): Artsy/Gravity OAuth via next-auth. Reads
   and writes require the Gravity `team` role.
2. **Service token** (machines): a request with `Authorization: Bearer <token>`
   whose token matches one configured in the `ORBIT_SERVICE_TOKENS` env
   (comma-separated) is authenticated as a **read-only** `service` principal.
   It can call read endpoints (`GET` engineers/rotations/schedule/on-call) but
   is rejected with `403` on any write (`POST`/`PATCH`/`PUT`/`DELETE`), with one
   exception: `POST /api/rotations/[id]/claim` (`Action.claim`). This is
   what a headless client such as a Slack bot uses. Leave `ORBIT_SERVICE_TOKENS`
   empty to disable service-token auth entirely.
