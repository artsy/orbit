import { Box, Text } from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import dayGridPlugin from "@fullcalendar/daygrid"
import FullCalendar from "@fullcalendar/react"
import { format, parseISO } from "date-fns"
import { FC, useMemo, useState } from "react"
import { Engineer } from "rotations/types"
import { engineerColor } from "rotations/colors"
import { useSchedule } from "utils/hooks/useApi"

interface RotationCalendarProps {
  rotationId: string
  timezone: string
  engineersById: Record<string, Engineer>
}

// Calendar date (YYYY-MM-DD) of an instant, in the rotation's timezone.
const zonedDate = (iso: string, timezone: string) =>
  format(new TZDate(parseISO(iso).getTime(), timezone), "yyyy-MM-dd")

export const RotationCalendar: FC<RotationCalendarProps> = ({
  rotationId,
  timezone,
  engineersById,
}) => {
  // FullCalendar reports the visible window via datesSet; we fetch the schedule
  // for exactly that range.
  const [range, setRange] = useState<{ start?: string; end?: string }>({})
  const { data: schedule, isLoading } = useSchedule(
    rotationId,
    range.start,
    range.end
  )

  const events = useMemo(() => {
    return (schedule?.entries ?? []).map((entry) => {
      const isSwap = !!entry.override?.swapGroupId
      const isOverride = !!entry.override
      const name = entry.effectiveEngineerId
        ? engineersById[entry.effectiveEngineerId]?.name ?? "Unknown"
        : "Unassigned"

      // One stable color per on-call engineer; the override/swap status is kept
      // legible with a title suffix rather than a separate color.
      const color = engineerColor(entry.effectiveEngineerId)
      const suffix = isSwap ? " (swap)" : isOverride ? " (override)" : ""

      return {
        title: `${name}${suffix}`,
        start: zonedDate(entry.periodStart, timezone),
        end: zonedDate(entry.periodEnd, timezone), // exclusive for all-day
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        textColor: "#FFFFFF",
      }
    })
  }, [schedule, engineersById, timezone])

  return (
    <Box>
      {isLoading && (
        <Text variant="xs" color="mono60" mb={0.5}>
          Updating…
        </Text>
      )}
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        events={events}
        eventDisplay="block"
        height="auto"
        firstDay={1}
        datesSet={(arg) => setRange({ start: arg.startStr, end: arg.endStr })}
      />
    </Box>
  )
}
