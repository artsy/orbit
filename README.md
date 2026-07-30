# Orbit

Engineer on-call rotation scheduler.

## Meta

- **State:** development
- **Staging:** [https://orbit-staging.artsy.net](https://orbit-staging.artsy.net)
- **Production:** [https://orbit.artsy.net](https://orbit.artsy.net)
- **Docs:** [https://artsy.github.io/orbit/](https://artsy.github.io/orbit/)
- **Deployment:**
  - Merges to `main` automatically deploy to staging.
  - Promoting `main` → `release` automatically deploys to production, gated by a Horizon release block. ([Start a deploy...](https://github.com/artsy/orbit/compare/release...main?expand=1))
- **Point People:** [@mounirdhahri](https://github.com/mounirdhahri)

## Getting Started

Orbit runs locally against Postgres in Docker. In brief:

```sh
yarn install
cp .env.example .env.local   # fill in Gravity creds + NEXTAUTH_SECRET
yarn db:up                   # start Postgres
yarn prisma:migrate          # create the schema
yarn seed                    # sample engineers, a rotation, a demo override + swap
yarn dev
```

Then open [http://localhost:3000](http://localhost:3000) and sign in with Artsy.

Full walkthrough — prerequisites, environment variables, and scripts — is on the
docs site: **[Getting started](https://artsy.github.io/orbit/getting-started.html)**.

## Troubleshooting

Common login, database, and setup issues are covered in
**[Troubleshooting](https://artsy.github.io/orbit/troubleshooting.html)**.

## About

Orbit manages engineer on-call rotations: a weekly round-robin over an ordered
list of engineers, with **overrides** (cover a date range) and **shift swaps**
(two engineers trade shifts) layered on top. The base schedule is always
computed, so removing an override restores the original assignment.

It mirrors Artsy's [`forque`](https://github.com/artsy/forque) stack — Next.js
(Pages Router), `@artsy/palette`, and next-auth via Gravity — and stores its own
data in Postgres via Prisma.

Full documentation: [https://artsy.github.io/orbit/](https://artsy.github.io/orbit/)
