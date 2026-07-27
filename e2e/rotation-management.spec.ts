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
  init: { members?: any[]; overrides?: any[] }
) {
  const state = {
    members: init.members ?? [],
    overrides: init.overrides ?? [],
  }

  await page.route("**/api/rotations/rot-1", (r) => r.fulfill({ json: rotation }))
  await page.route("**/api/engineers", (r) => r.fulfill({ json: engineers }))
  await page.route("**/api/rotations/rot-1/schedule**", (r) =>
    r.fulfill({ json: { rotation, members: state.members, entries: [] } })
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
})
