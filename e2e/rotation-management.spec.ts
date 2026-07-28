import { test, expect, type Page } from "@playwright/test"

const rotation = {
  id: "rot-1",
  name: "Platform on-call",
  cadenceDays: 7,
  anchorDate: "2026-01-05T00:00:00.000Z",
  timezone: "UTC",
  createdAt: "2026-01-01T00:00:00.000Z",
}

const engineers = [
  {
    id: "e1",
    name: "Ada Lovelace",
    email: "ada@artsymail.com",
    slackUsername: "@ada",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "e2",
    name: "Grace Hopper",
    email: "grace@artsymail.com",
    slackUsername: "@grace",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  // Matches the injected e2e session (see e2e/global-setup.ts) so row-click
  // "swap with me" resolves to this engineer.
  {
    id: "e3",
    name: "Test User",
    email: "test@artsymail.com",
    slackUsername: "@testuser",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]
const engineersById = Object.fromEntries(engineers.map((e) => [e.id, e]))

const memberFor = (engineerId: string, position: number) => ({
  id: `m-${engineerId}`,
  rotationId: "rot-1",
  engineerId,
  position,
  engineer: engineersById[engineerId],
})

async function mockRotationPage(
  page: Page,
  init: { members?: any[]; overrides?: any[]; entries?: any[] }
) {
  const state = {
    members: init.members ?? [],
    overrides: init.overrides ?? [],
    entries: init.entries ?? [],
  }

  await page.route("**/api/rotations/rot-1", (r) => r.fulfill({ json: rotation }))
  await page.route("**/api/engineers", (r) => r.fulfill({ json: engineers }))
  await page.route("**/api/rotations/rot-1/schedule**", (r) =>
    r.fulfill({ json: { rotation, members: state.members, entries: state.entries } })
  )

  await page.route("**/api/rotations/rot-1/members", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON()
      state.members = body.engineerIds.map((id: string, i: number) =>
        memberFor(id, i)
      )
      return route.fulfill({ json: state.members })
    }
    return route.fulfill({ json: state.members })
  })

  await page.route("**/api/rotations/rot-1/overrides", (route) =>
    route.fulfill({ json: state.overrides })
  )
  await page.route("**/api/overrides/*", async (route) => {
    if (route.request().method() === "DELETE") {
      state.overrides = []
      return route.fulfill({ json: {} })
    }
    return route.fallback()
  })

  return state
}

test.describe("rotation management", () => {
  test("adds an engineer to the on-call order", async ({ page }) => {
    await mockRotationPage(page, { members: [] })

    await page.goto("/rotations/rot-1")

    await expect(
      page.getByText("No engineers in this rotation yet")
    ).toBeVisible()

    await page.getByRole("combobox").selectOption({ label: "Ada Lovelace" })
    await page.getByRole("button", { name: "Add", exact: true }).click()

    await expect(page.getByText("Ada Lovelace")).toBeVisible()
  })

  test("removes a member from the on-call order", async ({ page }) => {
    await mockRotationPage(page, { members: [memberFor("e1", 0)] })

    await page.goto("/rotations/rot-1")

    await expect(page.getByText("Ada Lovelace")).toBeVisible()

    await page.getByRole("button", { name: "Remove" }).click()

    await expect(
      page.getByText("No engineers in this rotation yet")
    ).toBeVisible()
  })

  test("renders the on-call calendar", async ({ page }) => {
    await mockRotationPage(page, { members: [memberFor("e1", 0)] })

    await page.goto("/rotations/rot-1")

    // FullCalendar mounts client-side (dynamic import); its root + month title
    // should appear.
    await expect(page.locator(".fc")).toBeVisible()
    await expect(page.locator(".fc-toolbar-title")).toBeVisible()
  })

  test("removes an override", async ({ page }) => {
    await mockRotationPage(page, {
      members: [],
      overrides: [
        {
          id: "ov-1",
          rotationId: "rot-1",
          startDate: "2026-01-12T00:00:00.000Z",
          endDate: "2026-01-18T00:00:00.000Z",
          replacementEngineerId: "e2",
          originalEngineerId: "e1",
          reason: "conference",
          createdByEmail: "ada@artsymail.com",
          swapGroupId: null,
          createdAt: "2026-01-10T00:00:00.000Z",
        },
      ],
    })

    await page.goto("/rotations/rot-1")

    await expect(page.getByText("Covered by Grace Hopper")).toBeVisible()

    await page.getByRole("button", { name: "Remove" }).click()

    await expect(page.getByText("No active overrides")).toBeVisible()
  })

  test("clicking a schedule row opens a pre-filled swap with the signed-in user", async ({
    page,
  }) => {
    // Fixed, far-future dates so the "upcoming shifts" logic (which compares
    // against the real clock) always treats these periods as in the future.
    const entries = [
      {
        periodIndex: 0,
        periodStart: "2027-01-04T00:00:00.000Z",
        periodEnd: "2027-01-11T00:00:00.000Z",
        baseEngineerId: "e1",
        effectiveEngineerId: "e1",
        override: null,
      },
      {
        periodIndex: 1,
        periodStart: "2027-01-11T00:00:00.000Z",
        periodEnd: "2027-01-18T00:00:00.000Z",
        baseEngineerId: "e3",
        effectiveEngineerId: "e3",
        override: null,
      },
      {
        periodIndex: 2,
        periodStart: "2027-01-18T00:00:00.000Z",
        periodEnd: "2027-01-25T00:00:00.000Z",
        baseEngineerId: "e1",
        effectiveEngineerId: "e1",
        override: null,
      },
    ]

    await mockRotationPage(page, {
      members: [memberFor("e1", 0), memberFor("e3", 1)],
      entries,
    })

    await page.goto("/rotations/rot-1")

    // (a) the schedule table shows the base engineer (gray/top line) for a
    // period — scope to schedule rows (clickable) to avoid matching the
    // member list, which also renders "Ada Lovelace".
    const adaRows = page
      .getByRole("button", { name: "Swap this shift with me" })
      .filter({ hasText: "Ada Lovelace" })
    await expect(adaRows.first()).toBeVisible()

    // (b) click a schedule row assigned to the OTHER engineer (Ada, not the
    // signed-in test user) — this should open a pre-filled swap.
    await adaRows.first().click()

    const modal = page.getByRole("dialog").filter({ hasText: "Swap shifts" })
    await expect(modal).toBeVisible()

    // Engineer A is prefilled with the clicked row's engineer (Ada), engineer
    // B with the signed-in test user (matched by email to engineer e3).
    await expect(modal.locator('select[name="engineerAId"]')).toHaveValue("e1")
    await expect(modal.locator('select[name="engineerBId"]')).toHaveValue("e3")

    // The shift dropdowns are populated from each engineer's upcoming shifts.
    await expect(modal.locator('select[name="dateA"]')).toHaveValue(
      "2027-01-04T00:00:00.000Z"
    )
    await expect(modal.locator('select[name="dateB"]')).toHaveValue(
      "2027-01-11T00:00:00.000Z"
    )
  })
})
