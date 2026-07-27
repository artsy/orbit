---
layout: default
title: Orbit
---

# Orbit

Orbit is Artsy's internal **engineer on-call rotation scheduler**. It computes a
base weekly round-robin from an ordered list of engineers, and lets the team
layer **overrides** (one engineer covers another for a date range) and
**shift swaps** (two engineers trade upcoming shifts) on top. Data is stored in
Postgres; sign-in is Artsy/Gravity OAuth.

## Documentation

- **[Getting started](getting-started.html)** — run Orbit locally.
- **[Who's on call](whos-on-call.html)** — the endpoint that returns the current rotation.
- **[Managing engineers & rotations](managing-engineers.html)** — add or remove an engineer, create a rotation, set the on-call order.
- **[Overrides & swaps](overrides-and-swaps.html)** — cover a shift or swap two engineers.
- **[Architecture](architecture.html)** — how the pieces fit together.
- **[API contract](api-contract.html)** — every REST endpoint.
- **[Troubleshooting](troubleshooting.html)** — common setup and auth issues.

## How the schedule works

1. A **rotation** has an ordered list of member engineers, a **cadence** (7 days = weekly), and an **anchor date** (the start of period 0).
2. For any date, the base on-call engineer is `members[floor(daysSinceAnchor / cadence) mod memberCount]`.
3. **Overrides** replace the base engineer for a date range. **Swaps** are just two reciprocal overrides that share a `swapGroupId`.

The base rotation is always computed, never stored — so removing an override
instantly restores the original schedule.
