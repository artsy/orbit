/**
 * Deterministic, stable color per engineer, so the same person shows up in the
 * same color across the calendar, the schedule table, and on-call previews
 * (the incident.io / Opsgenie style of one color per on-call person).
 *
 * Engineers can also opt into an explicit color (from the curated palette
 * below) and an animated calendar pattern — see `colorForEngineer` and
 * `Engineer.pattern` in rotations/types.ts. Absent an explicit choice, both
 * fall back to this hashed default, so existing behavior is unchanged.
 *
 * Pure and dependency-free so it is safe to import from any layer.
 */
import { Engineer, EngineerPattern } from "rotations/types"

// Distinct, reasonably accessible hues with white text on top. Also the set
// of choices offered by the engineer color picker.
const PALETTE = [
  "#6E56CF", // violet
  "#30A46C", // green
  "#E5484D", // red
  "#F76B15", // orange
  "#0091FF", // blue
  "#E93D82", // pink
  "#F75998", // rose
  "#12A594", // teal
  "#8E4EC6", // purple
  "#5746AF", // indigo
]

/** Curated colors an engineer may choose from ("Auto" is represented by null). */
export const ENGINEER_COLORS = PALETTE

/** Animated calendar patterns an engineer may opt into. */
export const ENGINEER_PATTERNS: EngineerPattern[] = [
  "sparkles",
  "shimmer",
  "glow",
]

/** A random curated color — the default for a newly created engineer. */
export function randomEngineerColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

/** Stable color for an engineer id (same id → same color across renders). */
export function engineerColor(engineerId: string | null | undefined): string {
  if (!engineerId) return "#8B8B8B" // mono grey for "unassigned"
  let hash = 0
  for (let i = 0; i < engineerId.length; i++) {
    hash = (hash * 31 + engineerId.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/**
 * Color to render for an engineer: their explicit choice if set, otherwise
 * the stable hashed default for their id ("Auto").
 */
export function colorForEngineer(
  engineer: Engineer | null | undefined,
  engineerId: string | null | undefined
): string {
  return engineer?.color ?? engineerColor(engineerId)
}

/** True for any hex value from the curated palette, or null/undefined ("Auto"). */
export function isValidEngineerColor(
  color: string | null | undefined
): boolean {
  return color == null || (PALETTE as string[]).includes(color)
}

/** True for a known pattern, or null/undefined ("none"). */
export function isValidEngineerPattern(
  pattern: string | null | undefined
): boolean {
  return pattern == null || (ENGINEER_PATTERNS as string[]).includes(pattern)
}
