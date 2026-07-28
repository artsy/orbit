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

  test("searches engineers by name or email, showing at most the top 5 matches", async ({
    page,
  }) => {
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
      {
        id: "e3",
        name: "Alan Turing",
        email: "alan@artsymail.com",
        slackUsername: "@alan",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e4",
        name: "Katherine Johnson",
        email: "katherine@artsymail.com",
        slackUsername: "@katherine",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e5",
        name: "Margaret Hamilton",
        email: "margaret@artsymail.com",
        slackUsername: "@margaret",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e6",
        name: "Alan Kay",
        email: "alan.kay@artsymail.com",
        slackUsername: "@alankay",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]

    await page.route("**/api/engineers", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 201, json: existing[0] })
      }
      return route.fulfill({ json: existing })
    })

    await page.goto("/engineers")

    await expect(page.getByText("Ada Lovelace")).toBeVisible()

    const searchInput = page.getByPlaceholder("Search by name or email")
    const results = page.getByTestId("engineer-search-results")

    // Fewer than 3 characters: hint is shown, no results.
    await searchInput.fill("al")

    await expect(
      page.getByText("Type at least 3 characters to search.")
    ).toBeVisible()
    await expect(results).not.toBeVisible()

    // 3+ characters matching a name.
    await searchInput.fill("ada")

    await expect(
      page.getByText("Type at least 3 characters to search.")
    ).not.toBeVisible()
    await expect(results.getByText("Ada Lovelace", { exact: true })).toBeVisible()
    await expect(
      results.getByText("Grace Hopper", { exact: true })
    ).not.toBeVisible()

    // 3+ characters matching an email.
    await searchInput.fill("grace@artsymail.com")

    await expect(
      results.getByText("Grace Hopper", { exact: true })
    ).toBeVisible()
    await expect(
      results.getByText("Ada Lovelace", { exact: true })
    ).not.toBeVisible()

    // A query matching more than 5 engineers (via their shared email domain)
    // only shows the top 5.
    await searchInput.fill("artsymail")

    await expect(page.getByText("No matching engineers.")).not.toBeVisible()
    await expect(results).toBeVisible()
    const resultRows = results.getByText("@artsymail.com")
    await expect(resultRows).toHaveCount(5)
  })
})
