---
layout: home
hero:
  name: Orbit
  text: Engineer on-call rotation scheduler
  tagline: Weekly round-robin rotations with overrides and shift swaps, backed by Postgres.
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/artsy/orbit
features:
  - title: Getting started
    details: Run Orbit locally against Postgres.
    link: /getting-started
  - title: Who's on call
    details: The endpoint that returns the current rotation.
    link: /whos-on-call
  - title: Managing engineers & rotations
    details: Add or remove an engineer, create a rotation, set the on-call order.
    link: /managing-engineers
  - title: Overrides & swaps
    details: Cover a shift for a date range, or swap two engineers.
    link: /overrides-and-swaps
  - title: Architecture
    details: How the pieces fit together.
    link: /architecture
  - title: API contract
    details: Every REST endpoint.
    link: /api-contract
---

## How the schedule works

1. A **rotation** has an ordered list of member engineers, a **cadence** (7 days = weekly), and an **anchor date** (the start of period 0).
2. For any date, the base on-call engineer is `members[floor(daysSinceAnchor / cadence) mod memberCount]`.
3. **Overrides** replace the base engineer for a date range. **Swaps** are just two reciprocal overrides that share a `swapGroupId`.

The base rotation is always computed, never stored — so removing an override
instantly restores the original schedule.
