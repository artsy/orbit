/**
 * Deterministic, stable color per engineer, so the same person shows up in the
 * same color across the calendar, the schedule table, and on-call previews
 * (the incident.io / Opsgenie style of one color per on-call person).
 *
 * Pure and dependency-free so it is safe to import from any layer.
 */

// Distinct, reasonably accessible hues with white text on top.
const PALETTE = [
  "#6E56CF", // violet
  "#30A46C", // green
  "#E5484D", // red
  "#F76B15", // orange
  "#0091FF", // blue
  "#E93D82", // pink
  "#B5900A", // amber
  "#12A594", // teal
  "#8E4EC6", // purple
  "#5746AF", // indigo
]

/** Stable color for an engineer id (same id → same color across renders). */
export function engineerColor(engineerId: string | null | undefined): string {
  if (!engineerId) return "#8B8B8B" // mono grey for "unassigned"
  let hash = 0
  for (let i = 0; i < engineerId.length; i++) {
    hash = (hash * 31 + engineerId.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
