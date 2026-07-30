import { test, expect } from "@playwright/test"

// This flow is reached signed out (the sign-in itself was rejected), so run
// without the injected session storage state the other specs use.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("auth error page", () => {
  test("shows the denied account's email and a sign-out control", async ({
    page,
  }) => {
    await page.goto(
      "/auth/error?error=AccessDenied&email=someone%40example.com"
    )

    await expect(page.getByText("Access denied")).toBeVisible()
    await expect(page.getByText("someone@example.com")).toBeVisible()
    await expect(
      page.getByText("clears your Artsy session too", { exact: false })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  })

  test("shows a generic message without an email", async ({ page }) => {
    await page.goto("/auth/error?error=AccessDenied")

    await expect(page.getByText("Access denied")).toBeVisible()
    await expect(
      page.getByText("doesn't have permission to use Orbit", { exact: false })
    ).toBeVisible()
  })
})
