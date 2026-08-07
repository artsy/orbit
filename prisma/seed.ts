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

// artsy/release-lookout's ROTATION_EPOCH — the start of the biweekly release
// captain rotation, so period 0 maps to the first captain in the list.
const RELEASE_EPOCH = new Date("2026-06-11T00:00:00.000Z")

const DAY_MS = 24 * 60 * 60 * 1000

async function main() {
  // --- Clear existing data, FK-safe order -----------------------------------
  await prisma.event.deleteMany()
  await prisma.override.deleteMany()
  await prisma.rotationMember.deleteMany()
  await prisma.rotation.deleteMany()
  await prisma.engineer.deleteMany()

  // --- Engineers -------------------------------------------------------------
  // A couple have a chosen color/pattern so the calendar demonstrates the
  // effect right after seeding; the rest are left on "Auto" (hashed default).
  const engineerSeeds = [
    {
      name: "Ada Lovelace",
      email: "ada@artsymail.com",
      color: "#6E56CF",
      pattern: "sparkles",
    },
    { name: "Grace Hopper", email: "grace@artsymail.com" },
    {
      name: "Alan Turing",
      email: "alan@artsymail.com",
      color: "#0091FF",
      pattern: "shimmer",
    },
    { name: "Katherine Johnson", email: "katherine@artsymail.com" },
    { name: "Margaret Hamilton", email: "margaret@artsymail.com" },
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

  // --- Sample event log entries, for a populated demo ------------------------
  await prisma.event.create({
    data: {
      action: "rotation.created",
      actorEmail: "ada@artsymail.com",
      summary: `Created rotation "${rotation.name}"`,
      rotationId: rotation.id,
      rotationName: rotation.name,
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

  await prisma.event.create({
    data: {
      action: "override.created",
      actorEmail: "ada@artsymail.com",
      summary: `Added override for ${grace.name} on "${rotation.name}"`,
      rotationId: rotation.id,
      rotationName: rotation.name,
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

  await prisma.event.create({
    data: {
      action: "swap.created",
      actorEmail: "alan@artsymail.com",
      summary: `Swapped shifts between ${alan.name} and ${katherine.name} on "${rotation.name}"`,
      rotationId: rotation.id,
      rotationName: rotation.name,
    },
  })

  // --- Release Captain rotation ---------------------------------------------
  // Mirrors artsy/release-lookout's biweekly captain rotation: an ordered list
  // handed off every two weeks, anchored to release-lookout's ROTATION_EPOCH so
  // period 0 = the first captain. `slackUserId` is what a Slack bot needs to
  // @mention the on-call captain (the handle is display-only).
  const releaseCaptainSeeds = [
    {
      name: "Sultan Al-Maari",
      email: "Sultan.Al-Maari@artsymail.com",
      slackUserId: "U02CNMURE7R",
    },
    {
      name: "George Kartalis",
      email: "George.Kartalis@artsymail.com",
      slackUserId: "U023RJ49TUN",
    },
    {
      name: "Brian Beckerle",
      email: "brian.beckerle@artsymail.com",
      slackUserId: "URE5S7BBN",
    },
    {
      name: "Mounir Dhahri",
      email: "Mounir.Dhahri@artsymail.com",
      slackUserId: "U01427GSPK9",
    },
    {
      name: "Daria Kozlova",
      email: "Daria.Kozlova@artsymail.com",
      slackUserId: "U02HAF8J1QV",
    },
    {
      name: "Carlos",
      email: "carlos@artsymail.com",
      slackUserId: "U02DTPDPGTA",
    },
    {
      name: "Adam Iskounen",
      email: "adam.iskounen@artsymail.com",
      slackUserId: "UDQF9AV09",
    },
    {
      name: "Janae Edwards",
      email: "janae.edwards@artsymail.com",
      slackUserId: "UBDKQ4S0J",
    },
    {
      name: "Ole Richter",
      email: "ole.richter@artsymail.com",
      slackUserId: "U01RRGTBMU3",
    },
  ]

  const releaseCaptains = []
  for (const seed of releaseCaptainSeeds) {
    releaseCaptains.push(await prisma.engineer.create({ data: seed }))
  }

  const releaseRotation = await prisma.rotation.create({
    data: {
      name: "Release Captain",
      description:
        "Biweekly release-captain rotation (mirrors artsy/release-lookout).",
      cadenceDays: 14,
      anchorDate: RELEASE_EPOCH,
      timezone: "America/New_York",
    },
  })

  await prisma.rotationMember.createMany({
    data: releaseCaptains.map((engineer, position) => ({
      rotationId: releaseRotation.id,
      engineerId: engineer.id,
      position,
    })),
  })

  console.log("Seed complete:")
  console.log(
    `  - ${engineers.length} engineers (${engineers.map((e) => e.name).join(", ")})`
  )
  console.log(
    `  - 1 rotation: "${rotation.name}" (cadence ${rotation.cadenceDays}d, anchor ${rotation.anchorDate.toISOString()})`
  )
  console.log(
    `  - ${engineers.length} rotation members, positions 0-${engineers.length - 1}`
  )
  console.log(
    `  - 1 override: ${grace.name} covers ${ada.name} (${override.startDate.toISOString()} - ${override.endDate.toISOString()})`
  )
  console.log(
    `  - 1 swap (swapGroupId=${swapGroupId}): ${alan.name} <-> ${katherine.name}, ${swapOverrides.length} reciprocal overrides`
  )
  console.log(`  - ${margaret.name} remains on the unmodified base round-robin`)
  console.log(
    `  - 1 rotation: "${releaseRotation.name}" (biweekly), ${releaseCaptains.length} captains: ${releaseCaptains
      .map((e) => e.name)
      .join(", ")}`
  )
  console.log(
    `  - 3 event log entries (rotation created, override created, swap created)`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
