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
`@mentions` — stable across handle changes); `CreateEngineerBody` /
`UpdateEngineerBody` accept it.

## Rotations — domain `rotations`

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/rotations` | — | `Rotation[]` |
| POST | `/api/rotations` | `CreateRotationBody` | `Rotation` (201) |
| GET | `/api/rotations/[id]` | — | `Rotation` |
| PATCH | `/api/rotations/[id]` | `UpdateRotationBody` | `Rotation` |
| DELETE | `/api/rotations/[id]` | — | `Rotation` |
| GET | `/api/rotations/[id]/on-call` | — | `OnCallResponse` |

`GET /api/rotations/[id]/on-call` is a convenience view of **who's on call now
and next** (overrides/swaps applied), so callers don't have to fetch the full
schedule and do the date math. `OnCallResponse` is
`{ current: OnCallSlot | null, next: OnCallSlot | null }`, where `OnCallSlot` is
`{ engineer: Engineer | null, periodStart, periodEnd }` (ISO dates).

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

The `/swaps` handler uses `buildSwap` from the logic module to compute the two
override payloads, generates a shared `swapGroupId`, and persists both in a
transaction.

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
   is rejected with `403` on any write (`POST`/`PATCH`/`PUT`/`DELETE`). This is
   what a headless client such as a Slack bot uses. Leave `ORBIT_SERVICE_TOKENS`
   empty to disable service-token auth entirely.
