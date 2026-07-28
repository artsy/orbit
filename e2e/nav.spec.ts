import { test, expect } from "@playwright/test"

test.describe("global nav", () => {
  test("shows the Artsy logo, the Orbit brand link, and a log out control", async ({
    page,
  }) => {
    await page.route("**/api/rotations", (route) => route.fulfill({ json: [] }))

    await page.goto("/")

    await expect(page.getByText("Log out")).toBeVisible()
    await expect(page.locator("header svg").first()).toBeVisible()

    const brandLink = page.getByRole("link", { name: "Orbit" })
    await expect(brandLink).toBeVisible()
    await expect(brandLink).toHaveAttribute("href", "/")
    await expect(page.getByText("Orbit")).toBeVisible()
  })
})
