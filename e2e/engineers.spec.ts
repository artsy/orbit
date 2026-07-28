import { test, expect } from "@playwright/test"

test.describe("engineers", () => {
  test("lists engineers and adds a new one", async ({ page }) => {
    const existing = [
      {
        id: "e1",
        name: "Ada Lovelace",
        email: "ada@artsymail.com",
        slackUsername: "@ada",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]

    await page.route("**/api/engineers", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON()
        return route.fulfill({
          status: 201,
          json: {
            id: "e2",
            name: body.name,
            email: body.email,
            slackUsername: body.slackUsername ?? null,
            active: true,
            createdAt: "2026-01-02T00:00:00.000Z",
          },
        })
      }
      return route.fulfill({ json: existing })
    })

    await page.goto("/engineers")

    await expect(page.getByText("Ada Lovelace")).toBeVisible()

    await page.locator('input[name="name"]').fill("Grace Hopper")
    await page.locator('input[name="email"]').fill("grace@artsymail.com")
    await page.locator('input[name="slackUsername"]').fill("@grace")

    await page.getByRole("button", { name: "Add engineer" }).click()

    // Appears in the list (exact avoids matching the "Grace Hopper added" toast).
    await expect(
      page.getByText("Grace Hopper", { exact: true })
    ).toBeVisible()
  })

  test("deletes an engineer", async ({ page }) => {
    const existing = [
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

    let deletedId: string | null = null
    await page.route("**/api/engineers", (route) =>
      route.fulfill({ json: existing })
    )
    await page.route("**/api/engineers/*", (route) => {
      if (route.request().method() === "DELETE") {
        deletedId = route.request().url().split("/").pop() ?? null
        return route.fulfill({ json: existing[1] })
      }
      return route.fallback()
    })

    // The page confirms before deleting; auto-accept the dialog.
    page.on("dialog", (dialog) => dialog.accept())

    await page.goto("/engineers")

    await expect(page.getByText("Grace Hopper", { exact: true })).toBeVisible()

    // Delete Grace via the Delete button scoped to her row.
    await page
      .getByTestId("engineer-row-e2")
      .getByRole("button", { name: "Delete" })
      .click()

    // The DELETE hit her id, and she's removed from the list.
    await expect(page.getByTestId("engineer-row-e2")).toHaveCount(0)
    await expect(page.getByText("Ada Lovelace", { exact: true })).toBeVisible()
    expect(deletedId).toBe("e2")
  })
})
