---
layout: default
title: API contract
---

# Orbit API contract

[← Back to home](index.html)

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
| DELETE | `/api/engineers/[id]` | — | `Engineer` (soft-deactivate: set `active=false`) |

## Rotations — domain `rotations`

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/rotations` | — | `Rotation[]` |
| POST | `/api/rotations` | `CreateRotationBody` | `Rotation` (201) |
| GET | `/api/rotations/[id]` | — | `Rotation` |
| PATCH | `/api/rotations/[id]` | `UpdateRotationBody` | `Rotation` |
| DELETE | `/api/rotations/[id]` | — | `Rotation` |

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
| DELETE | `/api/overrides/[id]` | — | `Override` |

## Swaps — domain `overrides`

| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/rotations/[id]/swaps` | `CreateSwapBody` | `Override[]` (the two reciprocal overrides, sharing a `swapGroupId`) (201) |

The `/swaps` handler uses `buildSwap` from the logic module to compute the two
override payloads, generates a shared `swapGroupId`, and persists both in a
transaction.

## Health

| Method | Route | Response |
|---|---|---|
| GET | `/api/status` | `{ status: "OK" }` |
