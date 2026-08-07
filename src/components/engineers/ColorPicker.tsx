import { Box, Flex, Text } from "@artsy/palette"
import { FC } from "react"
import { ENGINEER_COLORS, engineerColor } from "rotations/colors"

interface ColorPickerProps {
  /** Chosen hex color, or null for "Auto" (the stable hashed default). */
  value: string | null
  onChange: (color: string | null) => void
  /** Engineer id, used only to preview the "Auto" swatch's actual color. */
  engineerId?: string | null
}

const SWATCH_SIZE = 24

/**
 * Curated color picker for an engineer's calendar appearance — a fixed
 * palette (rather than a free hex input) so the calendar bar's white text
 * always stays readable. "Auto" keeps the existing hashed-from-id default.
 */
export const ColorPicker: FC<ColorPickerProps> = ({
  value,
  onChange,
  engineerId,
}) => {
  const autoColor = engineerColor(engineerId)

  return (
    <Box>
      <Text variant="xs" color="mono60" mb={0.5}>
        Calendar color
      </Text>
      <Flex flexWrap="wrap" gap={0.5}>
        <Swatch
          color={autoColor}
          label="Auto"
          selected={value == null}
          onClick={() => onChange(null)}
          striped
        />
        {ENGINEER_COLORS.map((color) => (
          <Swatch
            key={color}
            color={color}
            label={color}
            selected={value === color}
            onClick={() => onChange(color)}
          />
        ))}
      </Flex>
    </Box>
  )
}

const Swatch: FC<{
  color: string
  label: string
  selected: boolean
  onClick: () => void
  striped?: boolean
}> = ({ color, label, selected, onClick, striped }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={selected}
    title={label}
    style={{
      width: SWATCH_SIZE,
      height: SWATCH_SIZE,
      borderRadius: "50%",
      background: striped
        ? `linear-gradient(135deg, ${color} 50%, #FFFFFF 50%)`
        : color,
      border: selected ? "2px solid #000000" : "1px solid rgba(0,0,0,0.15)",
      boxShadow: selected ? "0 0 0 2px #FFFFFF inset" : undefined,
      cursor: "pointer",
      padding: 0,
    }}
  />
)
