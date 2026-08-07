import { Box, Flex, Text } from "@artsy/palette"
import { FC } from "react"
import { ENGINEER_PATTERNS } from "rotations/colors"
import { EngineerPattern } from "rotations/types"
import {
  patternBarStyle,
  SparkleOverlay,
  SparkleStyles,
} from "components/schedule/sparkle"

interface PatternPickerProps {
  value: EngineerPattern | null
  onChange: (pattern: EngineerPattern | null) => void
  /** Bar color used for the live preview, so it matches the calendar. */
  previewColor: string
  /** Name shown in the live preview, so it matches the engineer being edited. */
  previewName: string
}

const LABELS: Record<EngineerPattern, string> = {
  sparkles: "Sparkles",
  shimmer: "Shimmer",
  glow: "Glow",
}

/**
 * Lets an engineer opt into an animated calendar pattern, with a live
 * preview of each option rendered exactly as it appears on the calendar bar
 * (see components/schedule/sparkle.tsx, shared with RotationCalendar).
 */
export const PatternPicker: FC<PatternPickerProps> = ({
  value,
  onChange,
  previewColor,
  previewName,
}) => (
  <Box>
    <SparkleStyles />
    <Text variant="xs" color="mono60" mb={0.5}>
      Calendar pattern
    </Text>
    <Flex flexWrap="wrap" gap={0.5}>
      <PatternOption
        pattern={null}
        label="None"
        selected={value == null}
        onClick={() => onChange(null)}
        previewColor={previewColor}
        previewName={previewName}
      />
      {ENGINEER_PATTERNS.map((pattern) => (
        <PatternOption
          key={pattern}
          pattern={pattern}
          label={LABELS[pattern]}
          selected={value === pattern}
          onClick={() => onChange(pattern)}
          previewColor={previewColor}
          previewName={previewName}
        />
      ))}
    </Flex>
  </Box>
)

const PatternOption: FC<{
  pattern: EngineerPattern | null
  label: string
  selected: boolean
  onClick: () => void
  previewColor: string
  previewName: string
}> = ({ pattern, label, selected, onClick, previewColor, previewName }) => {
  const { className, style } = patternBarStyle(pattern, previewColor)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: 4,
        background: "transparent",
        border: selected ? "2px solid #000000" : "1px solid rgba(0,0,0,0.15)",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      <div
        className={className}
        style={{
          position: "relative",
          width: 64,
          height: 20,
          borderRadius: 4,
          background: previewColor,
          color: "#FFFFFF",
          fontSize: 10,
          lineHeight: "20px",
          padding: "0 4px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...style,
        }}
      >
        <SparkleOverlay pattern={pattern} />
        {previewName || "Name"}
      </div>
      <Text variant="xs" color="mono100">
        {label}
      </Text>
    </button>
  )
}
