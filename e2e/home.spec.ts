import { test, expect } from "@playwright/test"

const rotation = (id: string, name: string) => ({
  id,
  name,
  cadenceDays: 7,
  anchorDate: "2026-01-05T00:00:00.000Z",
  timezone: "UTC",
  createdAt: "2026-01-01T00:00:00.000Z",
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

  test("lists rotations as links", async ({ page }) => {
    // Two rotations so the home page renders the list (not the inline schedule).
    await page.route("**/api/rotations", (route) =>
      route.fulfill({
        json: [rotation("rot-1", "Platform on-call"), rotation("rot-2", "Support")],
      })
    )

    await page.goto("/")

    await expect(
      page.getByRole("link", { name: "Platform on-call" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Support" })).toBeVisible()
  })
})
