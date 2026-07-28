import { test, expect } from "@playwright/test"

const rotation = (id: string, name: string) => ({
  id,
  name,
  cadenceDays: 7,
  anchorDate: "2026-01-05T00:00:00.000Z",
  timezone: "UTC",
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
})

// Engineers used by the on-call preview. `test@artsymail.com` matches the
// injected e2e session (see global-setup.ts), so it renders as "You".
const engineers = [
  {
    id: "e1",
    name: "Ada Lovelace",
    email: "ada@artsymail.com",
    slackUsername: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "e2",
    name: "Test User",
    email: "test@artsymail.com",
    slackUsername: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

// A schedule whose single period always contains "now", assigned to `engineerId`.
const alwaysOnCall = (rot: ReturnType<typeof rotation>, engineerId: string) => ({
  rotation: rot,
  members: [],
  entries: [
    {
      periodIndex: 0,
      periodStart: "2020-01-01T00:00:00.000Z",
      periodEnd: "2999-01-01T00:00:00.000Z",
      baseEngineerId: engineerId,
      effectiveEngineerId: engineerId,
      override: null,
    },
  ],
})

test.describe("home", () => {
  test("shows the empty state when there are no rotations", async ({ page }) => {
    await page.route("**/api/rotations", (route) => route.fulfill({ json: [] }))

    await page.goto("/")

    await expect(page.getByText("Engineer rotation")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "New rotation" })
    ).toBeVisible()
    await expect(page.getByText("No rotations yet")).toBeVisible()
  })

  test("lists rotations as links with a who-is-on-call preview", async ({
    page,
  }) => {
    const rotA = rotation("rot-1", "Platform on-call")
    const rotB = rotation("rot-2", "Support")

    await page.route("**/api/rotations", (route) =>
      route.fulfill({ json: [rotA, rotB] })
    )
    await page.route("**/api/engineers", (route) =>
      route.fulfill({ json: engineers })
    )
    // rot-1: Ada is on call; rot-2: the signed-in test user is on call.
    await page.route("**/api/rotations/rot-1/schedule**", (route) =>
      route.fulfill({ json: alwaysOnCall(rotA, "e1") })
    )
    await page.route("**/api/rotations/rot-2/schedule**", (route) =>
      route.fulfill({ json: alwaysOnCall(rotB, "e2") })
    )

    await page.goto("/")

    await expect(
      page.getByRole("link", { name: "Platform on-call" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Support" })).toBeVisible()

    // Someone else on call → their name; the current user → "You are on call".
    await expect(page.getByText(/Ada Lovelace is on call until/)).toBeVisible()
    await expect(page.getByText(/You are on call until/)).toBeVisible()
  })

  test("does not render inline schedule details, even with a single rotation", async ({
    page,
  }) => {
    const rot = rotation("rot-1", "Platform on-call")

    await page.route("**/api/rotations", (route) =>
      route.fulfill({ json: [rot] })
    )
    await page.route("**/api/engineers", (route) =>
      route.fulfill({ json: engineers })
    )
    await page.route("**/api/rotations/rot-1/schedule**", (route) =>
      route.fulfill({ json: alwaysOnCall(rot, "e1") })
    )

    await page.goto("/")

    await expect(
      page.getByRole("link", { name: "Platform on-call" })
    ).toBeVisible()

    // The compact on-call preview is allowed; the full details are not.
    await expect(page.getByText(/is on call until/)).toBeVisible()
    await expect(page.getByText("Schedule list")).toHaveCount(0)
    await expect(page.locator(".fc")).toHaveCount(0)
    await expect(page.getByText("Currently on-call:")).toHaveCount(0)
  })
})
