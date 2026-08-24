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
      const id = route.request().url().split("/").pop()
      state.overrides = state.overrides.filter(o => o.id !== id)
      return route.fulfill({ json: {} })
    }
    return route.fallback()
  })
  // Captured by tests via `state.lastSwapPost`; doesn't actually mutate
  // `state.overrides` — these specs only need to see what was requested.
  await page.route("**/api/rotations/rot-1/swaps", async (route) => {
    const body = route.request().postDataJSON()
    ;(state as any).lastSwapPost = body
    return route.fulfill({ json: [] })
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

  // ---------------------------------------------------------------------
  // Chained swaps — a swap layered on top of an existing one.
  //
  // Base order: e1 (Ada) / e2 (Grace) / e3 (Test User) on periods p0/p1/p2.
  // swap-1 already traded p0 <-> p2 (e1 <-> e3). swap-2 then chained off
  // swap-1's p0 leg, trading it for p1 (e2): effectively p0 = e2, p1 = e3,
  // p2 = e1. swap-1 is now shadowed on p0 but not on p2.
  //
  // Uses current-month dates (like `currentMonthOverride()` above) so the
  // periods render as calendar bars in FullCalendar's default month view.
  // ---------------------------------------------------------------------
  const chainedSwapFixture = () => {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth()
    // JS normalizes an out-of-range day-of-month (e.g. 37 in a 31-day month)
    // into the following month, so these stay 3 real consecutive weekly
    // periods even when day 16 + 3 weeks rolls past the month's end.
    const day = (d: number) => new Date(Date.UTC(y, m, d)).toISOString()
    const dayEnd = (d: number) => new Date(Date.UTC(y, m, d - 1)).toISOString()

    // Start on day 16 (not day 2): periods must still be *upcoming* relative
    // to whenever the suite actually runs — "upcomingShiftsFor" (real,
    // effective-based logic, not mocked) filters out anything already
    // ended — while day 16 is safely within the current month for
    // FullCalendar's default month view to render the bars at all.
    const p0Start = day(16)
    const p1Start = day(23)
    const p2Start = day(30)
    const p2End = day(37)

    const swap1a = {
      id: "swap1-a",
      rotationId: "rot-1",
      startDate: p0Start,
      endDate: dayEnd(23),
      replacementEngineerId: "e3",
      originalEngineerId: "e1",
      reason: null,
      createdByEmail: "ada@artsymail.com",
      swapGroupId: "swap-1",
      createdAt: "2026-01-10T00:00:00.000Z",
    }
    const swap1b = {
      id: "swap1-b",
      rotationId: "rot-1",
      startDate: p2Start,
      endDate: dayEnd(37),
      replacementEngineerId: "e1",
      originalEngineerId: "e3",
      reason: null,
      createdByEmail: "ada@artsymail.com",
      swapGroupId: "swap-1",
      createdAt: "2026-01-10T00:00:00.000Z",
    }
    const swap2a = {
      id: "swap2-a",
      rotationId: "rot-1",
      startDate: p0Start,
      endDate: dayEnd(23),
      replacementEngineerId: "e2",
      originalEngineerId: "e3",
      reason: null,
      createdByEmail: "ada@artsymail.com",
      swapGroupId: "swap-2",
      createdAt: "2026-01-11T00:00:00.000Z",
    }
    const swap2b = {
      id: "swap2-b",
      rotationId: "rot-1",
      startDate: p1Start,
      endDate: dayEnd(30),
      replacementEngineerId: "e3",
      originalEngineerId: "e2",
      reason: null,
      createdByEmail: "ada@artsymail.com",
      swapGroupId: "swap-2",
      createdAt: "2026-01-11T00:00:00.000Z",
    }

    const entries = [
      {
        periodIndex: 0,
        periodStart: p0Start,
        periodEnd: p1Start,
        baseEngineerId: "e1",
        effectiveEngineerId: "e2", // swap-2 wins (newer)
        override: swap2a,
      },
      {
        periodIndex: 1,
        periodStart: p1Start,
        periodEnd: p2Start,
        baseEngineerId: "e2",
        effectiveEngineerId: "e3", // swap-2's other leg
        override: swap2b,
      },
      {
        periodIndex: 2,
        periodStart: p2Start,
        periodEnd: p2End,
        baseEngineerId: "e3",
        effectiveEngineerId: "e1", // swap-1's untouched leg
        override: swap1b,
      },
    ]

    return {
      // `startModify`'s replacement-baseline recompute calls the real pure
      // logic against the rotation's actual anchor/cadence — so the anchor
      // is pinned to p0Start, aligning that math exactly to this fixture's
      // hand-picked dates instead of whatever the module-level `rotation`
      // constant (anchored 2026-01-05) would otherwise put there.
      rotation: { ...rotation, anchorDate: p0Start, cadenceDays: 7 },
      members: [memberFor("e1", 0), memberFor("e2", 1), memberFor("e3", 2)],
      overrides: [swap1a, swap1b, swap2a, swap2b],
      entries,
    }
  }

  // `mockRotationPage` always serves the module-level `rotation` constant for
  // the plain rotation GET; registering this after it wins (same trick as
  // "edits a rotation from the rotation page" above) so these tests' custom
  // anchorDate reaches the client's own schedule math.
  async function useFixtureRotation(page: Page, fixtureRotation: any) {
    await page.route("**/api/rotations/rot-1", (route) =>
      route.fulfill({ json: fixtureRotation })
    )
  }

  test("offers Add swap on an already-swapped period, targeting the effective engineer", async ({
    page,
  }) => {
    const fixture = chainedSwapFixture()
    const state = await mockRotationPage(page, fixture)
    await useFixtureRotation(page, fixture.rotation)

    await page.goto("/rotations/rot-1")

    // p0's bar shows Grace (swap-2's effective engineer), not Ada (base).
    const calendar = page.locator(".fc")
    await calendar.getByText("Grace Hopper").first().click()

    const actionsDialog = page.getByRole("dialog").filter({ hasText: "Swap" })
    await expect(actionsDialog).toBeVisible()
    await actionsDialog.getByRole("button", { name: "Add swap" }).click()

    const swapModal = page
      .getByRole("dialog")
      .filter({ hasText: "Swap shifts" })
    await expect(swapModal).toBeVisible()
    // Engineer A is prefilled with Grace — the effective holder — not Ada.
    await expect(swapModal.locator('select[name="engineerAId"]')).toHaveValue(
      "e2"
    )
    await expect(swapModal.locator('select[name="dateA"]')).toHaveValue(
      fixture.entries[0].periodStart
    )

    // Pick Ada (e1) as engineer B — she's effectively on p2, not her base p0.
    await swapModal.locator('select[name="engineerBId"]').selectOption("e1")
    await expect(swapModal.locator('select[name="dateB"]')).toHaveValue(
      fixture.entries[2].periodStart
    )

    await swapModal.getByRole("button", { name: "Swap shifts" }).click()
    await expect(swapModal).not.toBeVisible()

    expect((state as any).lastSwapPost).toMatchObject({
      engineerAId: "e2",
      engineerBId: "e1",
      dateA: fixture.entries[0].periodStart,
      dateB: fixture.entries[2].periodStart,
    })
  })

  test("disables Modify and Delete on a swap a later swap has chained off of", async ({
    page,
  }) => {
    const fixture = chainedSwapFixture()
    await mockRotationPage(page, fixture)
    await useFixtureRotation(page, fixture.rotation)

    await page.goto("/rotations/rot-1")

    // p2's bar belongs to swap-1, which is unshadowed there — but swap-1 is
    // shadowed on p0 by swap-2, so the group as a whole must be gated.
    // "Ada Lovelace" also appears earlier (day 2) as period 0's muted,
    // non-clickable "replaced" bar (its base engineer) — .last() is p2's
    // clickable effective bar, since FullCalendar sorts events by start date.
    const calendar = page.locator(".fc")
    await calendar.getByText("Ada Lovelace").last().click()

    const dialog = page.getByRole("dialog").filter({ hasText: "Swap" })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/later swap has since covered part of this one/)
    ).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Modify" })).toBeDisabled()
    await expect(dialog.getByRole("button", { name: "Delete" })).toBeDisabled()
    // Add swap remains available regardless.
    await expect(dialog.getByRole("button", { name: "Add swap" })).toBeEnabled()
  })

  test("modifying the current (topmost) swap prefills from the post-removal schedule", async ({
    page,
  }) => {
    const fixture = chainedSwapFixture()
    const state = await mockRotationPage(page, fixture)
    await useFixtureRotation(page, fixture.rotation)

    await page.goto("/rotations/rot-1")

    // p0's bar belongs to swap-2, which is current on both its periods
    // (p0 and p1) — Modify must be available and correct here.
    const calendar = page.locator(".fc")
    await calendar.getByText("Grace Hopper").first().click()

    const dialog = page.getByRole("dialog").filter({ hasText: "Swap" })
    await expect(dialog.getByRole("button", { name: "Modify" })).toBeEnabled()
    await dialog.getByRole("button", { name: "Modify" }).click()

    const editModal = page.getByRole("dialog").filter({ hasText: "Edit swap" })
    await expect(editModal).toBeVisible()
    // The replacement baseline (swap-2's own rows removed) is swap-1's state:
    // p0 = e3 (Test User), p1 = e2 (Grace) — not swap-2's own effect on
    // itself, and not the base round robin either.
    await expect(editModal.locator('select[name="engineerAId"]')).toHaveValue(
      "e3"
    )
    await expect(editModal.locator('select[name="engineerBId"]')).toHaveValue(
      "e2"
    )

    await editModal.getByRole("button", { name: "Save changes" }).click()
    await expect(editModal).not.toBeVisible()

    // Both of swap-2's rows were deleted, then a fresh swap POSTed.
    expect((state as any).lastSwapPost).toMatchObject({
      engineerAId: "e3",
      engineerBId: "e2",
    })
  })
})
