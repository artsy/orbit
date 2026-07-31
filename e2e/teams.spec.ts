import { test, expect } from "@playwright/test"

test.describe("teams", () => {
  test("lists teams and creates a new one", async ({ page }) => {
    const teams = [{ id: "t1", name: "Backend", createdAt: "2026-01-01T00:00:00.000Z" }]

    await page.route("**/api/teams", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON()
        const created = {
          id: "t2",
          name: body.name,
          createdAt: "2026-01-02T00:00:00.000Z",
        }
        teams.push(created)
        return route.fulfill({ status: 201, json: created })
      }
      return route.fulfill({ json: teams })
    })

    await page.goto("/teams")

    await expect(page.getByText("Backend", { exact: true })).toBeVisible()

    await page.locator('input[name="name"]').fill("Frontend")
    await page.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Frontend", { exact: true })).toBeVisible()
  })

  test("manages a team's roster and renames it", async ({ page }) => {
    let team = { id: "t1", name: "Backend", createdAt: "2026-01-01T00:00:00.000Z" }
    const engineers = [
      {
        id: "e1",
        name: "Ada Lovelace",
        email: "ada@artsymail.com",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        name: "Grace Hopper",
        email: "grace@artsymail.com",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]
    const engineersById = Object.fromEntries(engineers.map((e) => [e.id, e]))

    let members: { id: string; teamId: string; engineerId: string; engineer: any }[] = []

    await page.route("**/api/teams/t1", async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON()
        team = { ...team, name: body.name }
        return route.fulfill({ json: team })
      }
      return route.fulfill({ json: team })
    })
    await page.route("**/api/engineers", (route) => route.fulfill({ json: engineers }))
    await page.route("**/api/teams/t1/members", async (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON()
        members = body.engineerIds.map((id: string) => ({
          id: `tm-${id}`,
          teamId: "t1",
          engineerId: id,
          engineer: engineersById[id],
        }))
        return route.fulfill({ json: members })
      }
      return route.fulfill({ json: members })
    })

    await page.goto("/teams/t1")

    await expect(page.getByText("No engineers on this team yet")).toBeVisible()

    // Add Ada to the roster.
    await page.getByRole("combobox").selectOption({ label: "Ada Lovelace" })
    await page.getByRole("button", { name: "Add", exact: true }).click()

    await expect(page.getByText("Ada Lovelace", { exact: true })).toBeVisible()

    // Remove her again.
    await page.getByRole("button", { name: "Remove" }).click()

    await expect(page.getByText("No engineers on this team yet")).toBeVisible()

    // Rename the team.
    await page.locator('input[name="teamName"]').fill("Platform")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Platform", { exact: true }).first()).toBeVisible()
  })
})
