import { CSSProperties, FC } from "react"
import { EngineerPattern } from "rotations/types"

/**
 * Shared CSS-animated "patterns" an engineer can opt into for their calendar
 * appearance (rotations/colors.ts ENGINEER_PATTERNS). Real animated
 * particles/gradients — not emoji — kept in plain CSS so they render cheaply
 * across many small calendar cells. Mount <SparkleStyles /> once per page
 * that uses <SparkleOverlay>/<SparkleMark>.
 */
export const SparkleStyles: FC = () => (
  <style>{`
    @keyframes orbit-twinkle {
      0%   { opacity: 0; transform: scale(0.2) rotate(0deg); }
      50%  { opacity: 1; transform: scale(1) rotate(180deg); }
      100% { opacity: 0; transform: scale(0.2) rotate(360deg); }
    }
    @keyframes orbit-shimmer-sweep {
      0%   { background-position: -150% 0; }
      100% { background-position: 250% 0; }
    }
    @keyframes orbit-glow-pulse {
      0%, 100% { box-shadow: 0 0 2px 0 var(--orbit-glow-color, #fff); }
      50%      { box-shadow: 0 0 8px 3px var(--orbit-glow-color, #fff); }
    }
    .orbit-sparkle-star {
      position: absolute;
      width: 6px;
      height: 6px;
      background: #FFFFFF;
      clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
      filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.9));
      animation: orbit-twinkle 1.6s ease-in-out infinite;
      pointer-events: none;
    }
    .orbit-shimmer-sheen {
      position: absolute;
      inset: 0;
      background: linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.55) 50%, transparent 70%);
      background-size: 200% 100%;
      animation: orbit-shimmer-sweep 2.2s linear infinite;
      pointer-events: none;
    }
    .orbit-glow-pulse {
      animation: orbit-glow-pulse 1.8s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .orbit-sparkle-star, .orbit-shimmer-sheen, .orbit-glow-pulse {
        animation: none;
      }
      .orbit-sparkle-star { opacity: 0.9; transform: scale(0.8); }
      .orbit-shimmer-sheen { display: none; }
      .orbit-glow-pulse { box-shadow: 0 0 4px 1px var(--orbit-glow-color, #fff); }
    }
  `}</style>
)

/**
 * Style overrides for the element the pattern is applied to. Only "glow"
 * needs this: an animated box-shadow is clipped by `overflow: hidden`, which
 * the calendar bar otherwise uses for text-ellipsis truncation.
 */
export function patternBarStyle(
  pattern: EngineerPattern | null | undefined,
  color: string
): { className?: string; style?: CSSProperties } {
  if (pattern !== "glow") return {}
  return {
    className: "orbit-glow-pulse",
    style: {
      overflow: "visible",
      ["--orbit-glow-color" as string]: color,
    },
  }
}

// Spread across the full bar width (as percentages, since bars vary in
// width — a multi-day override spans much wider than a single day) rather
// than clustered at one edge, alternating vertical position and animation
// delay so they don't all twinkle in lockstep.
const SPARKLE_POSITIONS: Array<{
  left: string
  top?: number
  bottom?: number
  size: number
  delay: string
}> = [
  { left: "4%", top: 2, size: 5, delay: "0s" },
  { left: "24%", bottom: 1, size: 4, delay: "0.3s" },
  { left: "46%", top: 1, size: 5, delay: "0.9s" },
  { left: "68%", bottom: 2, size: 4, delay: "0.5s" },
  { left: "88%", top: 3, size: 5, delay: "1.1s" },
]

/**
 * Overlay rendered as a child of a `position: relative` bar for "sparkles"
 * (twinkling star particles) and "shimmer" (a sweeping sheen). "glow" is
 * applied to the bar itself via `patternBarStyle` instead. Renders nothing
 * for no pattern.
 */
export const SparkleOverlay: FC<{ pattern: EngineerPattern | null }> = ({
  pattern,
}) => {
  if (pattern === "sparkles") {
    return (
      <>
        {SPARKLE_POSITIONS.map((s, i) => (
          <span
            key={i}
            className="orbit-sparkle-star"
            style={{
              left: s.left,
              top: s.top,
              bottom: s.bottom,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
            }}
          />
        ))}
      </>
    )
  }

  if (pattern === "shimmer") {
    return <span className="orbit-shimmer-sheen" />
  }

  return null
}

/**
 * A small static twinkle cue for plain-text contexts (schedule table,
 * "on call until…" preview) where a full overlay doesn't fit — indicates the
 * engineer has an animated pattern enabled without reproducing it.
 */
export const SparkleMark: FC<{
  pattern: EngineerPattern | null | undefined
  color: string
}> = ({ pattern, color }) => {
  if (!pattern) return null
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        display: "inline-block",
        width: 8,
        height: 8,
      }}
    >
      <span
        className="orbit-sparkle-star"
        style={{ top: 0, left: 0, background: color }}
      />
    </span>
  )
}
