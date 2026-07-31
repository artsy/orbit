# Orbit — agent & contributor guide

Orbit is Artsy's internal **engineer on-call rotation scheduler**: a base weekly
round-robin over an ordered list of engineers, with **overrides** (cover a date
range) and **shift swaps** (two engineers trade shifts) layered on top. Next.js
(Pages Router) + @artsy/palette + next-auth (Artsy/Gravity) + Prisma/Postgres.

Full documentation lives in [`docs/`](docs/) and is published to
<https://artsy.github.io/orbit/>.

## Using the app (quick reference)

- **Run locally:** `yarn install` → `cp .env.example .env.local` (fill in Gravity + `NEXTAUTH_SECRET`) → `yarn db:up` → `yarn prisma:migrate` → `yarn seed` → `yarn dev`. Artsy engineers can replace the first two steps with `yarn setup:artsy` (installs deps + pulls `.env.local` from Citadel). Full steps: [docs/getting-started.md](docs/getting-started.md).
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

- Run `yarn type-check`, `yarn lint`, and `yarn test` before committing — CI enforces all three. `yarn e2e` runs the Playwright end-to-end suite (also in CI).
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

## Keep the e2e tests in sync (required)

**Whenever a user-facing flow is added or changed, update the Playwright e2e
tests (`e2e/`) to match, when it makes sense.** If you add a new page or a new
interaction (a form, a button that mutates data, a navigation), add or extend a
spec that drives it against mocked `/api` responses. If you change an existing
flow, update its spec. Skip only when there's genuinely nothing user-facing to
exercise (pure refactors, backend-only tweaks with no UI change) — and say so.
Tests run as an injected-session user; we do not e2e-test the auth flow itself.

## Include screenshots or a recording in PRs, when it makes sense

**Any user-facing/UI change should show what changed, not just describe it** —
use the PR template's "Screenshots / recording" section. A before/after pair
is ideal; if there's no meaningful "before" (a new page or component), just
show the current view. For a flow a still image can't convey — a multi-step
interaction, a drag, an animation, a modal sequence — record a short screen
capture instead. Skip this for backend-only or non-visual changes.

Drive the running app with Playwright or the Chrome DevTools MCP tools to
capture these rather than describing the UI in prose. Run the app for real
(`yarn dev`) against seeded local data — don't settle for a mocked e2e page as
a substitute for an actual screenshot.

Signed-in pages need a real Gravity session, which an agent can't complete
non-interactively. **Ask the user to sign in** in the browser tab being
driven, then continue capturing once they confirm — don't skip the
screenshots/recording section just because auth is in the way.

To keep an embedded image working after a PR's branch is deleted on merge,
host it on a small dedicated `screenshots/pr-<number>` branch (pushed, and
deliberately never deleted) rather than the PR's own feature branch, and
reference it via a `raw.githubusercontent.com` URL.
