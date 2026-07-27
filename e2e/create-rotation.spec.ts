import { test, expect } from "@playwright/test"

const newRotation = {
  id: "rot-new",
  name: "My rotation",
  cadenceDays: 7,
  anchorDate: "2026-07-20T10:00:00.000Z",
  timezone: "UTC",
  createdAt: "2026-07-20T00:00:00.000Z",
}

test.describe("create rotation", () => {
  test("creates a rotation from the UI and redirects to it", async ({
    page,
  }) => {
    await page.route("**/api/rotations", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 201, json: newRotation })
      }
      return route.fulfill({ json: [] })
    })

    // The destination rotation page loads these on mount.
    await page.route("**/api/rotations/rot-new", (r) =>
      r.fulfill({ json: newRotation })
    )
    await page.route("**/api/rotations/rot-new/members", (r) =>
      r.fulfill({ json: [] })
    )
    await page.route("**/api/rotations/rot-new/overrides", (r) =>
      r.fulfill({ json: [] })
    )
    await page.route("**/api/rotations/rot-new/schedule**", (r) =>
      r.fulfill({ json: { rotation: newRotation, members: [], entries: [] } })
    )
    await page.route("**/api/engineers", (r) => r.fulfill({ json: [] }))

    await page.goto("/rotations/new")

    await page.locator('input[name="name"]').fill("My rotation")
    await page.locator('input[name="startDate"]').fill("2026-07-20")
    // cadence (weekly) and start hour default, so no need to touch the selects.

    await page.getByRole("button", { name: "Create rotation" }).click()

    await expect(page).toHaveURL(/\/rotations\/rot-new/)
  })
})
