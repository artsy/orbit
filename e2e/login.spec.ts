import { test, expect } from "@playwright/test"

// Run these logged out (no injected session), unlike the rest of the suite.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("login screen", () => {
  test("shows a sign-in button for each configured provider", async ({
    page,
  }) => {
    await page.goto("/")

    // The button list is driven by next-auth's getProviders(); the Artsy
    // provider is always configured.
    await expect(
      page.getByRole("button", { name: "Continue with Artsy" })
    ).toBeVisible()
  })
})
