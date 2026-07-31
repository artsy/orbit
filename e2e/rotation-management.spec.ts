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
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "e2",
    name: "Grace Hopper",
    email: "grace@artsymail.com",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  // Matches the injected e2e session (see e2e/global-setup.ts) so row-click
  // "swap with me" resolves to this engineer.
  {
    id: "e3",
    name: "Test User",
    email: "test@artsymail.com",
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
  init: {
    members?: any[]
    overrides?: any[]
    entries?: any[]
    teams?: any[]
  }
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
  // The "Add a team" picker calls useTeams() unconditionally; default to none
  // so tests that don't care about Teams don't hit the real API.
  await page.route("**/api/teams", (r) => r.fulfill({ json: init.teams ?? [] }))

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

  test("edits a rotation from the rotation page", async ({ page }) => {
    await mockRotationPage(page, { members: [] })

    let patched: any = null
    // Registered after mockRotationPage so it wins for this exact path; handles
    // both the GET (page load) and the PATCH (save).
    await page.route("**/api/rotations/rot-1", async (route) => {
      if (route.request().method() === "PATCH") {
        patched = route.request().postDataJSON()
        return route.fulfill({ json: { ...rotation, name: patched.name } })
      }
      return route.fulfill({ json: rotation })
    })

    await page.goto("/rotations/rot-1")

    await page.getByRole("button", { name: "Edit rotation" }).click()

    const modal = page.getByRole("dialog").filter({ hasText: "Edit rotation" })
    await expect(modal).toBeVisible()
    await expect(modal.locator('input[name="name"]')).toHaveValue(
      "Platform on-call"
    )

    await modal.locator('input[name="name"]').fill("Platform & Infra")
    await modal.getByRole("button", { name: "Save changes" }).click()

    await expect(modal).not.toBeVisible()
    expect(patched?.name).toBe("Platform & Infra")
  })

  test("opens this rotation's event log", async ({ page }) => {
    await mockRotationPage(page, { members: [] })
    await page.route("**/api/events*", (route) =>
      route.fulfill({
        json: [
          {
            id: "evt-1",
            action: "rotation.created",
            summary: 'Created rotation "Platform on-call"',
            actorEmail: "ada@artsymail.com",
            rotationId: "rot-1",
            rotationName: "Platform on-call",
            createdAt: "2026-01-01T09:00:00.000Z",
          },
        ],
      })
    )

    await page.goto("/rotations/rot-1")

    await page.getByRole("button", { name: "Event log" }).click()

    await expect(page).toHaveURL("/events?rotationId=rot-1")
    await expect(page.getByText("Event log — Platform on-call")).toBeVisible()
    await expect(page.getByText("Rotation created")).toBeVisible()
  })

  test("renders the on-call calendar", async ({ page }) => {
    await mockRotationPage(page, { members: [memberFor("e1", 0)] })

    await page.goto("/rotations/rot-1")

    // FullCalendar mounts client-side (dynamic import); its root + month title
    // should appear.
    await expect(page.locator(".fc")).toBeVisible()
    await expect(page.locator(".fc-toolbar-title")).toBeVisible()

    // Weekend columns are present and shaded (weekend-shading CSS targets
    // these FullCalendar-provided classes).
    await expect(page.locator(".fc-day-sat").first()).toBeVisible()
    await expect(page.locator(".fc-day-sun").first()).toBeVisible()
  })

  test("switches between the 2 weeks and Month calendar views", async ({
    page,
  }) => {
    await mockRotationPage(page, { members: [memberFor("e1", 0)] })

    await page.goto("/rotations/rot-1")

    // Both view options are offered; Month is the default active view.
    const twoWeek = page.getByRole("button", { name: "2 weeks" })
    const month = page.getByRole("button", { name: "Month", exact: true })
    await expect(twoWeek).toBeVisible()
    await expect(month).toBeVisible()
    await expect(page.locator(".fc-dayGridMonth-button")).toHaveClass(
      /fc-button-active/
    )

    // Switching to the 2-week view makes it the active one.
    await twoWeek.click()
    await expect(page.locator(".fc-dayGridTwoWeek-button")).toHaveClass(
      /fc-button-active/
    )
    await expect(page.locator(".fc")).toBeVisible()
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

  test("selecting an engineer in the swap form populates their shifts immediately", async ({
    page,
  }) => {
    const entries = [
      {
        periodIndex: 0,
        periodStart: "2027-02-01T00:00:00.000Z",
        periodEnd: "2027-02-08T00:00:00.000Z",
        baseEngineerId: "e1",
        effectiveEngineerId: "e1",
        override: null,
      },
      {
        periodIndex: 1,
        periodStart: "2027-02-08T00:00:00.000Z",
        periodEnd: "2027-02-15T00:00:00.000Z",
        baseEngineerId: "e2",
        effectiveEngineerId: "e2",
        override: null,
      },
    ]

    await mockRotationPage(page, {
      members: [memberFor("e1", 0), memberFor("e2", 1)],
      entries,
    })

    await page.goto("/rotations/rot-1")

    // Open the manual swap modal (no prefill).
    await page.getByRole("button", { name: "Swap shifts" }).click()
    const modal = page.getByRole("dialog").filter({ hasText: "Swap shifts" })
    await expect(modal).toBeVisible()

    // Selecting engineer A the FIRST time should immediately populate the shift
    // dropdown with that engineer's nearest upcoming shift (regression: it used
    // to stay empty until you switched engineers and back).
    await modal.locator('select[name="engineerAId"]').selectOption("e1")
    await expect(modal.locator('select[name="dateA"]')).toHaveValue(
      "2027-02-01T00:00:00.000Z"
    )
    await expect(
      modal.locator(
        'select[name="dateA"] option[value="2027-02-01T00:00:00.000Z"]'
      )
    ).toHaveCount(1)
  })

  test("tapping the on-call bar in the calendar opens the same swap", async ({
    page,
  }) => {
    // Use a period inside the current month so it is visible in the calendar's
    // default (current-month) view, regardless of when the suite runs.
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth()
    const periodStart = new Date(Date.UTC(y, m, 2)).toISOString()
    const periodEnd = new Date(Date.UTC(y, m, 9)).toISOString()

    await mockRotationPage(page, {
      members: [memberFor("e1", 0), memberFor("e3", 1)],
      entries: [
        {
          periodIndex: 0,
          periodStart,
          periodEnd,
          baseEngineerId: "e1",
          effectiveEngineerId: "e1",
          override: null,
        },
      ],
    })

    await page.goto("/rotations/rot-1")

    // Click Ada's on-call bar within the calendar (scope to `.fc` so we don't
    // match the schedule table or member list, which also render her name).
    const calendar = page.locator(".fc")
    await expect(calendar).toBeVisible()
    await calendar.getByText("Ada Lovelace").first().click()

    // The same pre-filled Swap dialog opens: engineer A = the clicked bar's
    // engineer (Ada / e1), engineer B = the signed-in test user (e3).
    const modal = page.getByRole("dialog").filter({ hasText: "Swap shifts" })
    await expect(modal).toBeVisible()
    await expect(modal.locator('select[name="engineerAId"]')).toHaveValue("e1")
    await expect(modal.locator('select[name="engineerBId"]')).toHaveValue("e3")
  })

  const currentMonthOverride = () => {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth()
    const periodStart = new Date(Date.UTC(y, m, 2)).toISOString()
    const periodEnd = new Date(Date.UTC(y, m, 9)).toISOString()
    const override = {
      id: "ov-1",
      rotationId: "rot-1",
      startDate: periodStart,
      endDate: new Date(Date.UTC(y, m, 8)).toISOString(),
      replacementEngineerId: "e2",
      originalEngineerId: "e1",
      reason: "conference",
      createdByEmail: "ada@artsymail.com",
      swapGroupId: null,
      createdAt: "2020-01-01T00:00:00.000Z",
    }
    const entry = {
      periodIndex: 0,
      periodStart,
      periodEnd,
      baseEngineerId: "e1",
      effectiveEngineerId: "e2",
      override,
    }
    return { override, entry }
  }

  test("tapping an override in the calendar can delete it", async ({ page }) => {
    const { override, entry } = currentMonthOverride()
    await mockRotationPage(page, {
      members: [memberFor("e1", 0), memberFor("e2", 1)],
      overrides: [override],
      entries: [entry],
    })

    await page.goto("/rotations/rot-1")
    await expect(page.getByText("Covered by Grace Hopper")).toBeVisible()

    // Tap the covering engineer's bar in the calendar → actions dialog.
    await page.locator(".fc").getByText("Grace Hopper").first().click()
    const dialog = page.getByRole("dialog").filter({ hasText: "is covering" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Modify" })).toBeVisible()

    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText("No active overrides")).toBeVisible()
  })

  test("tapping an override in the calendar can modify it (prefilled form)", async ({
    page,
  }) => {
    const { override, entry } = currentMonthOverride()
    await mockRotationPage(page, {
      members: [memberFor("e1", 0), memberFor("e2", 1)],
      overrides: [override],
      entries: [entry],
    })

    await page.goto("/rotations/rot-1")

    await page.locator(".fc").getByText("Grace Hopper").first().click()
    const dialog = page.getByRole("dialog").filter({ hasText: "is covering" })
    await dialog.getByRole("button", { name: "Modify" }).click()

    // The prefilled edit form opens with the override's replacement engineer.
    const editModal = page.getByRole("dialog").filter({ hasText: "Edit override" })
    await expect(editModal).toBeVisible()
    await expect(
      editModal.locator('select[name="replacementEngineerId"]')
    ).toHaveValue("e2")
    await expect(
      editModal.getByRole("button", { name: "Save changes" })
    ).toBeVisible()
  })

  test("adds a full team to the on-call order", async ({ page }) => {
    const team = { id: "team-1", name: "Backend", createdAt: "2026-01-01T00:00:00.000Z" }

    await mockRotationPage(page, { members: [memberFor("e3", 0)], teams: [team] })
    await page.route("**/api/teams/team-1/members", (route) =>
      route.fulfill({
        json: [
          { id: "tm-1", teamId: "team-1", engineerId: "e1", engineer: engineersById.e1 },
          { id: "tm-2", teamId: "team-1", engineerId: "e2", engineer: engineersById.e2 },
        ],
      })
    )

    await page.goto("/rotations/rot-1")

    await expect(page.getByText("Test User")).toBeVisible()

    // Two comboboxes now render in the members editor — "Add engineer" first,
    // then "Add a team" (palette's Select doesn't expose an accessible name).
    await page.getByRole("combobox").nth(1).selectOption({ label: "Backend" })
    await page.getByRole("button", { name: "Add team" }).click()

    // Both of the team's engineers land in the on-call order, alongside the
    // engineer who was already a member.
    await expect(page.getByText("Ada Lovelace")).toBeVisible()
    await expect(page.getByText("Grace Hopper")).toBeVisible()
    await expect(page.getByText("Test User")).toBeVisible()
  })
})
