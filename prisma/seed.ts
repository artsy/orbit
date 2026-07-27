/**
 * Seed script (stub — fleshed out in WP6).
 *
 * Run with: `yarn seed` (after `yarn prisma migrate dev`).
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // WP6 populates sample engineers, a weekly rotation, and a demo override/swap.
  console.log("Seed stub — nothing to do yet.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
