// Guard run before `yarn dev`: make sure the developer's local database has the
// committed migrations applied, so they don't run the app against a stale
// schema and see old/missing data. Blocks only when migrations are definitely
// pending; if the database simply isn't reachable yet, it warns and continues
// (you may be about to `yarn db:up`).
import { execSync } from "node:child_process"

function migrateStatus() {
  try {
    const out = execSync("prisma migrate status", {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    })
    return { ok: true, out }
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}` }
  }
}

const { ok, out } = migrateStatus()

if (ok) {
  process.exit(0)
}

const pending =
  /not yet been applied|following migration|not up to date|drift detected/i.test(
    out
  )

if (pending) {
  console.error(
    "\n⚠️  Your local database is behind the committed migrations.\n" +
      "   Run `yarn prisma:migrate` to apply them before starting the app,\n" +
      "   otherwise you may see stale data or schema errors.\n"
  )
  process.exit(1)
}

const unreachable =
  /P1001|P1000|P1003|can't reach database server|environment variable not found: database_url/i.test(
    out
  )

if (unreachable) {
  console.warn(
    "\n⚠️  Couldn't verify database migrations (is Postgres running? try `yarn db:up`). Continuing.\n"
  )
  process.exit(0)
}

// Unknown problem — surface it but don't block dev.
console.warn("\n⚠️  Could not verify database migrations:\n" + out.trim() + "\n")
process.exit(0)
