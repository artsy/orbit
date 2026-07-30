import { test, expect } from "@playwright/test"

test.describe("global nav", () => {
  test("shows the Artsy logo, the Orbit brand link, and a log out control", async ({
    page,
  }) => {
    await page.route("**/api/rotations", (route) => route.fulfill({ json: [] }))

    await page.goto("/")

    await expect(page.getByText("Log out")).toBeVisible()
    await expect(page.locator("header img").first()).toBeVisible()

    const brandLink = page.getByRole("link", { name: "Orbit" })
    await expect(brandLink).toBeVisible()
    await expect(brandLink).toHaveAttribute("href", "/")
    await expect(page.getByText("Orbit")).toBeVisible()
  })

  test("highlights the active section", async ({ page }) => {
    await page.route("**/api/engineers", (route) => route.fulfill({ json: [] }))

    await page.goto("/engineers")

    // The Engineers nav link's text is underlined when its section is active.
    const engineersText = page
      .getByRole("link", { name: "Engineers" })
      .locator("> *")
      .first()
    await expect(engineersText).toHaveCSS("text-decoration-line", "underline")
  })

  test("links to the Event Log and highlights it when active", async ({
    page,
  }) => {
    await page.route("**/api/rotations", (route) => route.fulfill({ json: [] }))
    await page.route("**/api/events", (route) => route.fulfill({ json: [] }))

    await page.goto("/")

    const eventLogLink = page.getByRole("link", { name: "Event log" })
    await expect(eventLogLink).toBeVisible()

    await eventLogLink.click()
    await expect(page).toHaveURL("/events")

    const eventLogText = eventLogLink.locator("> *").first()
    await expect(eventLogText).toHaveCSS("text-decoration-line", "underline")
  })
})
