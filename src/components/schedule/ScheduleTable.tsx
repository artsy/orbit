import { Box, Flex, Pill, Text } from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import { format, parseISO } from "date-fns"
import { FC } from "react"
import { Engineer, ScheduleEntry } from "rotations/types"

interface ScheduleTableProps {
  entries: ScheduleEntry[]
  engineersById: Record<string, Engineer>
  /** Times are displayed in this IANA timezone (the rotation's). */
  timezone: string
}

const inZone = (iso: string, timezone: string) =>
  new TZDate(parseISO(iso).getTime(), timezone)

const isCurrentPeriod = (entry: ScheduleEntry, today: Date): boolean => {
  const start = parseISO(entry.periodStart)
  const end = parseISO(entry.periodEnd)
  return start <= today && today < end
}

const engineerName = (
  id: string | null,
  engineersById: Record<string, Engineer>
): string => {
  if (!id) return "Unassigned"
  return engineersById[id]?.name ?? "Unknown engineer"
}

export const ScheduleTable: FC<ScheduleTableProps> = ({
  entries,
  engineersById,
  timezone,
}) => {
  const today = new Date()

  if (entries.length === 0) {
    return (
      <Text variant="sm" color="mono60">
        No scheduled periods in this window.
      </Text>
    )
  }

  return (
    <Box>
      <Text variant="xs" color="mono60" mb={0.5}>
        Times shown in {timezone}
      </Text>

      <Flex
        py={0.5}
        borderBottom="1px solid"
        borderColor="mono30"
        alignItems="center"
      >
        <Box width="25%">
          <Text variant="xs" color="mono60">
            Period
          </Text>
        </Box>
        <Box width="45%">
          <Text variant="xs" color="mono60">
            On-call
          </Text>
        </Box>
        <Box width="30%">
          <Text variant="xs" color="mono60">
            Notes
          </Text>
        </Box>
      </Flex>

      {entries.map((entry) => {
        const hasOverride = !!entry.override
        const isSwap = hasOverride && !!entry.override?.swapGroupId
        const showBaseStrikethrough =
          hasOverride && entry.baseEngineerId !== entry.effectiveEngineerId
        const highlighted = isCurrentPeriod(entry, today)

        return (
          <Flex
            key={entry.periodIndex}
            py={1}
            alignItems="center"
            bg={highlighted ? "yellow10" : undefined}
            borderBottom="1px solid"
            borderColor="mono10"
          >
            <Box width="25%">
              <Text variant="sm">
                {format(inZone(entry.periodStart, timezone), "MMM d, HH:mm")} –{" "}
                {format(
                  inZone(
                    new Date(parseISO(entry.periodEnd).getTime() - 1).toISOString(),
                    timezone
                  ),
                  "MMM d"
                )}
              </Text>
            </Box>

            <Box width="45%">
              <Text variant="sm">
                {engineerName(entry.effectiveEngineerId, engineersById)}
              </Text>
              {showBaseStrikethrough && (
                <Text
                  variant="xs"
                  color="mono60"
                  style={{ textDecoration: "line-through" }}
                >
                  {engineerName(entry.baseEngineerId, engineersById)}
                </Text>
              )}
            </Box>

            <Box width="30%">
              {hasOverride && (
                <Pill variant="badge">{isSwap ? "swap" : "override"}</Pill>
              )}
            </Box>
          </Flex>
        )
      })}
    </Box>
  )
}
