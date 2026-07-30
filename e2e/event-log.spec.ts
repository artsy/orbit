import { test, expect } from "@playwright/test"

test.describe("event log", () => {
  test("shows recorded events in a table", async ({ page }) => {
    const events = [
      {
        id: "evt-2",
        action: "override.created",
        summary: 'Added override for Grace Hopper on "Platform on-call"',
        actorEmail: "ada@artsymail.com",
        rotationId: "rot-1",
        rotationName: "Platform on-call",
        createdAt: "2026-01-02T10:00:00.000Z",
      },
      {
        id: "evt-1",
        action: "rotation.created",
        summary: 'Created rotation "Platform on-call"',
        actorEmail: "ada@artsymail.com",
        rotationId: "rot-1",
        rotationName: "Platform on-call",
        createdAt: "2026-01-01T09:00:00.000Z",
      },
    ]

    await page.route("**/api/events", (route) => route.fulfill({ json: events }))

    await page.goto("/events")

    await expect(page.getByText("Event Log", { exact: true })).toBeVisible()

    // Both rows render, with actor email, humanized action, and summary.
    await expect(page.getByText("ada@artsymail.com").first()).toBeVisible()
    await expect(page.getByText("Override created")).toBeVisible()
    await expect(page.getByText("Rotation created")).toBeVisible()
    await expect(
      page.getByText('Added override for Grace Hopper on "Platform on-call"')
    ).toBeVisible()

    // The rotation name links back to the rotation.
    await expect(
      page.getByRole("link", { name: "Platform on-call" }).first()
    ).toHaveAttribute("href", "/rotations/rot-1")
  })

  test("shows an empty state when there are no events yet", async ({
    page,
  }) => {
    await page.route("**/api/events", (route) => route.fulfill({ json: [] }))

    await page.goto("/events")

    await expect(page.getByText("No events recorded yet.")).toBeVisible()
  })
})
