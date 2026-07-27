/**
 * Idempotent seed script for local development.
 *
 * Clears existing rows (in FK-safe order) and recreates a small, realistic
 * dataset: five engineers, one weekly rotation, a one-off override, and a
 * reciprocal shift swap. Safe to re-run at any time with `yarn seed`.
 *
 * Run with: `yarn seed` (after `yarn prisma:migrate`).
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Fixed anchor date so the seeded schedule is stable across runs — a Monday.
const ANCHOR_DATE = new Date("2026-07-20T00:00:00.000Z")

const DAY_MS = 24 * 60 * 60 * 1000

async function main() {
  // --- Clear existing data, FK-safe order -----------------------------------
  await prisma.override.deleteMany()
  await prisma.rotationMember.deleteMany()
  await prisma.rotation.deleteMany()
  await prisma.engineer.deleteMany()

  // --- Engineers -------------------------------------------------------------
  const engineerSeeds = [
    { name: "Ada Lovelace", email: "ada@artsymail.com", slackUsername: "@ada" },
    {
      name: "Grace Hopper",
      email: "grace@artsymail.com",
      slackUsername: "@grace",
    },
    {
      name: "Alan Turing",
      email: "alan@artsymail.com",
      slackUsername: "@alan",
    },
    {
      name: "Katherine Johnson",
      email: "katherine@artsymail.com",
      slackUsername: "@katherine",
    },
    {
      name: "Margaret Hamilton",
      email: "margaret@artsymail.com",
      slackUsername: "@margaret",
    },
  ]

  const engineers = []
  for (const seed of engineerSeeds) {
    const engineer = await prisma.engineer.create({ data: seed })
    engineers.push(engineer)
  }

  // --- Rotation ----------------------------------------------------------
  const rotation = await prisma.rotation.create({
    data: {
      name: "Platform on-call",
      cadenceDays: 7,
      anchorDate: ANCHOR_DATE,
      timezone: "America/New_York",
    },
  })

  // --- Rotation members, ordered round-robin -------------------------------
  await prisma.rotationMember.createMany({
    data: engineers.map((engineer, position) => ({
      rotationId: rotation.id,
      engineerId: engineer.id,
      position,
    })),
  })

  const [ada, grace, alan, katherine, margaret] = engineers

  // --- Demo override: Grace covers Ada's second shift ------------------------
  const overrideStart = new Date(ANCHOR_DATE.getTime() + 7 * DAY_MS)
  const overrideEnd = new Date(ANCHOR_DATE.getTime() + 14 * DAY_MS)
  const override = await prisma.override.create({
    data: {
      rotationId: rotation.id,
      startDate: overrideStart,
      endDate: overrideEnd,
      replacementEngineerId: grace.id,
      originalEngineerId: ada.id,
      reason: "Ada is out at a conference",
      createdByEmail: "ada@artsymail.com",
    },
  })

  // --- Demo swap: Alan and Katherine trade their upcoming shifts -------------
  const swapGroupId = "seed-swap-1"
  const alanShiftStart = new Date(ANCHOR_DATE.getTime() + 14 * DAY_MS)
  const alanShiftEnd = new Date(ANCHOR_DATE.getTime() + 21 * DAY_MS)
  const katherineShiftStart = new Date(ANCHOR_DATE.getTime() + 21 * DAY_MS)
  const katherineShiftEnd = new Date(ANCHOR_DATE.getTime() + 28 * DAY_MS)

  const swapOverrides = await prisma.$transaction([
    // Katherine covers Alan's shift.
    prisma.override.create({
      data: {
        rotationId: rotation.id,
        startDate: alanShiftStart,
        endDate: alanShiftEnd,
        replacementEngineerId: katherine.id,
        originalEngineerId: alan.id,
        reason: "Shift swap with Katherine",
        createdByEmail: "alan@artsymail.com",
        swapGroupId,
      },
    }),
    // Alan covers Katherine's shift, in exchange.
    prisma.override.create({
      data: {
        rotationId: rotation.id,
        startDate: katherineShiftStart,
        endDate: katherineShiftEnd,
        replacementEngineerId: alan.id,
        originalEngineerId: katherine.id,
        reason: "Shift swap with Alan",
        createdByEmail: "katherine@artsymail.com",
        swapGroupId,
      },
    }),
  ])

  console.log("Seed complete:")
  console.log(`  - ${engineers.length} engineers (${engineers.map((e) => e.name).join(", ")})`)
  console.log(`  - 1 rotation: "${rotation.name}" (cadence ${rotation.cadenceDays}d, anchor ${rotation.anchorDate.toISOString()})`)
  console.log(`  - ${engineers.length} rotation members, positions 0-${engineers.length - 1}`)
  console.log(`  - 1 override: ${grace.name} covers ${ada.name} (${override.startDate.toISOString()} - ${override.endDate.toISOString()})`)
  console.log(`  - 1 swap (swapGroupId=${swapGroupId}): ${alan.name} <-> ${katherine.name}, ${swapOverrides.length} reciprocal overrides`)
  console.log(`  - ${margaret.name} remains on the unmodified base round-robin`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
