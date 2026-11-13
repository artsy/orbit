import { test, expect, type Page } from "@playwright/test"

const turnRotation = {
  id: "rot-turn",
  name: "Bounty triage",
  cadenceDays: 7,
  anchorDate: "2026-01-05T00:00:00.000Z",
  timezone: "UTC",
  description: null,
  kind: "turn",
  nextPosition: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
}

const engineers = [
  ["e1", "Ada Lovelace", "ada@artsymail.com"],
  ["e2", "Grace Hopper", "grace@artsymail.com"],
  ["e3", "Test User", "test@artsymail.com"],
].map(([id, name, email]) => ({
  id,
  name,
  email,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}))
const engineersById = Object.fromEntries(engineers.map((e) => [e.id, e]))

const memberFor = (engineerId: string, position: number) => ({
  id: `m-${engineerId}`,
  rotationId: "rot-turn",
  engineerId,
  position,
  engineer: engineersById[engineerId],
})

const today = new Date().toISOString().slice(0, 10)

async function mockTurnRotation(
  page: Page,
  init: { members?: any[]; overrides?: any[] } = {}
) {
  const state = {
    members: init.members ?? [],
    overrides: init.overrides ?? [],
    scheduleRequests: 0,
    lastOverridePost: null as any,
  }

  await page.route("**/api/rotations/rot-turn", (r) =>
    r.fulfill({ json: turnRotation })
  )
  await page.route("**/api/engineers", (r) => r.fulfill({ json: engineers }))
  await page.route("**/api/teams", (r) => r.fulfill({ json: [] }))
  await page.route("**/api/rotations/rot-turn/schedule**", (r) => {
    state.scheduleRequests++
    return r.fulfill({ status: 400, json: { error: "turn rotation" } })
  })
  await page.route("**/api/rotations/rot-turn/members", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON()
      state.members = body.engineerIds.map((id: string, i: number) =>
        memberFor(id, i)
      )
    }
    return route.fulfill({ json: state.members })
  })
  await page.route("**/api/rotations/rot-turn/overrides", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON()
      state.lastOverridePost = body
      state.overrides = [
        {
          id: "ov-1",
          rotationId: "rot-turn",
          swapGroupId: null,
          createdByEmail: "test@artsymail.com",
          createdAt: new Date().toISOString(),
          reason: body.reason,
          startDate: `${body.startDate}T00:00:00.000Z`,
          endDate: `${body.endDate}T00:00:00.000Z`,
          replacementEngineerId: body.replacementEngineerId,
          originalEngineerId: body.originalEngineerId,
        },
      ]
      return route.fulfill({ status: 201, json: state.overrides[0] })
    }
    return route.fulfill({ json: state.overrides })
  })

  return state
}

test.describe("turn-based rotations", () => {
  test("creates a turn-based rotation without cadence or anchor fields", async ({
    page,
  }) => {
    let postedBody: any = null
    await page.route("**/api/rotations", async (route) => {
      if (route.request().method() === "POST") {
        postedBody = route.request().postDataJSON()
        return route.fulfill({ status: 201, json: turnRotation })
      }
      return route.fulfill({ json: [] })
    })
    await mockTurnRotation(page)

    await page.goto("/rotations/new")

    await expect(page.locator('select[name="cadence"]')).toBeVisible()
    await page.locator('select[name="kind"]').selectOption({ label: "Turn-based" })

    await expect(page.locator('select[name="cadence"]')).toHaveCount(0)
    await expect(page.locator('input[name="startDate"]')).toHaveCount(0)
    await expect(page.locator('select[name="startHour"]')).toHaveCount(0)
    await expect(page.locator('select[name="timezone"]')).toBeVisible()

    await page.locator('input[name="name"]').fill("Bounty triage")
    await page.getByRole("button", { name: "Create rotation" }).click()

    await expect(page).toHaveURL(/\/rotations\/rot-turn/)
    expect(postedBody.kind).toBe("turn")
    expect(postedBody.name).toBe("Bounty triage")
    expect(postedBody).not.toHaveProperty("anchorDate")
    expect(postedBody).not.toHaveProperty("cadenceDays")
  })

  test("shows the turn order, marks who is next, and hides schedule features", async ({
    page,
  }) => {
    const state = await mockTurnRotation(page)

    await page.goto("/rotations/rot-turn")

    for (const name of ["Ada Lovelace", "Grace Hopper", "Test User"]) {
      await page.getByRole("combobox").first().selectOption({ label: name })
      await page.getByRole("button", { name: "Add", exact: true }).click()
      await expect(page.getByText(name).first()).toBeVisible()
    }

    const turnOrder = page.getByTestId("turn-order")
    const rows = turnOrder.getByRole("listitem")
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText("Ada Lovelace")
    await expect(rows.nth(0)).toContainText("Next up")
    await expect(rows.nth(1)).not.toContainText("Next up")
    await expect(rows.nth(2)).not.toContainText("Next up")

    await expect(
      page.getByRole("button", { name: "Swap shifts" })
    ).toHaveCount(0)
    await expect(page.getByText("Schedule list")).toHaveCount(0)
    await expect(page.locator(".fc")).toHaveCount(0)
    await expect(page.getByText("Overrides & swaps")).toBeVisible()
    expect(state.scheduleRequests).toBe(0)
  })

  test("asks which engineer an override covers and moves next-up to the replacement", async ({
    page,
  }) => {
    const state = await mockTurnRotation(page, {
      members: [memberFor("e1", 0), memberFor("e2", 1), memberFor("e3", 2)],
    })

    await page.goto("/rotations/rot-turn")
    await page.getByRole("button", { name: "Add override" }).click()

    const modal = page.getByRole("dialog").filter({ hasText: "Add override" })
    await expect(modal.getByText("Engineer being covered")).toBeVisible()

    await modal.locator('select[name="originalEngineerId"]').selectOption("e1")
    await modal.locator('select[name="replacementEngineerId"]').selectOption("e3")
    await modal.locator('input[name="startDate"]').fill(today)
    await modal.locator('input[name="endDate"]').fill(today)
    await modal.getByRole("button", { name: "Create override" }).click()

    await expect(modal).not.toBeVisible()
    expect(state.lastOverridePost.originalEngineerId).toBe("e1")
    expect(state.lastOverridePost.replacementEngineerId).toBe("e3")

    const rows = page.getByTestId("turn-order").getByRole("listitem")
    await expect(rows.nth(2)).toContainText("Next up")
    await expect(rows.nth(0)).not.toContainText("Next up")
    await expect(
      page.getByText("Test User covering Ada Lovelace")
    ).toBeVisible()
  })

  test("requires the covered engineer when creating an override", async ({
    page,
  }) => {
    const state = await mockTurnRotation(page, {
      members: [memberFor("e1", 0), memberFor("e2", 1)],
    })

    await page.goto("/rotations/rot-turn")
    await page.getByRole("button", { name: "Add override" }).click()

    const modal = page.getByRole("dialog").filter({ hasText: "Add override" })
    await modal.locator('select[name="replacementEngineerId"]').selectOption("e2")
    await modal.locator('input[name="startDate"]').fill(today)
    await modal.locator('input[name="endDate"]').fill(today)
    await modal.getByRole("button", { name: "Create override" }).click()

    await expect(
      modal.getByText("The engineer being covered is required")
    ).toBeVisible()
    await expect(modal).toBeVisible()
    expect(state.lastOverridePost).toBeNull()
  })

  test("edit modal hides cadence and anchor fields and never sends kind", async ({
    page,
  }) => {
    await mockTurnRotation(page, { members: [memberFor("e1", 0)] })
    let patched: any = null
    await page.route("**/api/rotations/rot-turn", async (route) => {
      if (route.request().method() === "PATCH") {
        patched = route.request().postDataJSON()
        return route.fulfill({ json: { ...turnRotation, name: patched.name } })
      }
      return route.fulfill({ json: turnRotation })
    })

    await page.goto("/rotations/rot-turn")
    await page.getByRole("button", { name: "Edit rotation" }).click()

    const modal = page.getByRole("dialog").filter({ hasText: "Edit rotation" })
    await expect(modal.locator('select[name="cadence"]')).toHaveCount(0)
    await expect(modal.locator('input[name="startDate"]')).toHaveCount(0)
    await expect(modal.locator('select[name="startHour"]')).toHaveCount(0)

    await modal.locator('input[name="name"]').fill("Bounty queue")
    await modal.getByRole("button", { name: "Save changes" }).click()
    await expect(modal).not.toBeVisible()

    expect(patched.name).toBe("Bounty queue")
    expect(patched).not.toHaveProperty("kind")
    expect(patched).not.toHaveProperty("anchorDate")
    expect(patched).not.toHaveProperty("cadenceDays")
  })

  test("home card shows who is next up", async ({ page }) => {
    await page.route("**/api/rotations", (r) =>
      r.fulfill({ json: [turnRotation] })
    )
    await mockTurnRotation(page, {
      members: [memberFor("e1", 0), memberFor("e2", 1)],
    })

    await page.goto("/")

    await expect(page.getByText("Next up: Ada Lovelace")).toBeVisible()
    await expect(page.getByText("Turn-based rotation")).toBeVisible()
    await expect(page.getByText("Weekly rotation")).toHaveCount(0)
  })
})
