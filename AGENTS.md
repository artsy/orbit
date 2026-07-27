# Orbit — agent & contributor guide

Orbit is Artsy's internal **engineer on-call rotation scheduler**: a base weekly
round-robin over an ordered list of engineers, with **overrides** (cover a date
range) and **shift swaps** (two engineers trade shifts) layered on top. Next.js
(Pages Router) + @artsy/palette + next-auth (Artsy/Gravity) + Prisma/Postgres.

Full documentation lives in [`docs/`](docs/) and is published to
<https://artsy.github.io/orbit/>.

## Using the app (quick reference)

- **Run locally:** `yarn install` → `cp .env.example .env.local` (fill in Gravity + `NEXTAUTH_SECRET`) → `yarn db:up` → `yarn prisma:migrate` → `yarn seed` → `yarn dev`. Full steps: [docs/getting-started.md](docs/getting-started.md).
- **Add / remove an engineer:** manage person records on the `/engineers` page (add, or soft-deactivate). Putting an engineer on-call means adding them to a rotation's ordered membership (`PUT /api/rotations/[id]/members`). See [docs/managing-engineers.md](docs/managing-engineers.md).
- **Add an override / swap shifts:** use the buttons on `/rotations/[id]`, or the `overrides` / `swaps` endpoints. See [docs/overrides-and-swaps.md](docs/overrides-and-swaps.md).
- **Auth:** Artsy/Gravity OAuth; the `team` role is required to sign in and to write.

## Repository map

| Path | Responsibility |
|---|---|
| `src/rotations/types.ts` | Shared type contract for every layer. |
| `src/rotations/logic/` | Pure schedule computation (round-robin, overrides, swaps). No DB/UI. |
| `src/pages/api/` | REST endpoints (`docs/api-contract.md`), Prisma-backed. |
| `src/system/` | RBAC + app boot. |
| `src/components/`, `src/pages/` | Palette UI and routes. |
| `prisma/schema.prisma` | Data model. |
| `docs/` | Documentation site (published to GitHub Pages). |

## Best practices

- Run `yarn type-check`, `yarn lint`, and `yarn test` before committing — CI enforces all three.
- Keep the pure logic in `src/rotations/logic/` free of DB/UI/IO so it stays unit-testable; add tests there for any schedule-behaviour change.
- Match the existing style: Prettier (no semicolons, double quotes, ES5 trailing commas), palette components with styled-system props, `.page.tsx` for routes, and `baseUrl: "./src"` imports.
- Treat `src/rotations/types.ts` as a contract — changing it ripples through the API and UI, so update all consumers together.

## Keep the docs in sync (required)

**Any change to app behaviour must be reflected in `docs/` in the same change.** Specifically:

- New/changed/removed API endpoint → update [`docs/api-contract.md`](docs/api-contract.md).
- Change to how engineers or rotation membership are managed → update [`docs/managing-engineers.md`](docs/managing-engineers.md).
- Change to overrides or swaps → update [`docs/overrides-and-swaps.md`](docs/overrides-and-swaps.md).
- Change to setup, scripts, or env vars → update [`docs/getting-started.md`](docs/getting-started.md) and `.env.example`.
- Structural/architectural change → update [`docs/architecture.md`](docs/architecture.md).

The docs site redeploys automatically on every push to `main` that touches
`docs/` (via `.github/workflows/pages.yml`), so keeping the Markdown current is
all that's needed to keep the website current. A PR that changes behaviour
without a matching docs update should be considered incomplete.
