/**
 * Timezones a rotation may use. Keep this in sync with the create-rotation
 * form's Select and the API validation.
 */
export const ALLOWED_TIMEZONES = [
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
] as const

export type AllowedTimezone = (typeof ALLOWED_TIMEZONES)[number]

/** Human-friendly labels for the create-rotation Select. */
export const TIMEZONE_LABELS: Record<AllowedTimezone, string> = {
  "Europe/Berlin": "Berlin (Europe/Berlin)",
  "Europe/London": "London (Europe/London)",
  "America/New_York": "New York (America/New_York)",
}

export const DEFAULT_TIMEZONE: AllowedTimezone = "Europe/Berlin"

export const isAllowedTimezone = (tz: string): tz is AllowedTimezone =>
  (ALLOWED_TIMEZONES as readonly string[]).includes(tz)
