import { Box, Text } from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import type { EventContentArg, EventInput } from "@fullcalendar/core"
import dayGridPlugin from "@fullcalendar/daygrid"
import FullCalendar from "@fullcalendar/react"
import { format, parseISO } from "date-fns"
import { FC, useMemo, useState } from "react"
import { Engineer } from "rotations/types"
import { engineerColor } from "rotations/colors"
import { useSchedule } from "utils/hooks/useApi"

// Fully custom event rendering (see events builder): the covering engineer is a
// solid colored bar; an overridden period also gets a separate, muted
// struck-through bar for the originally scheduled engineer, stacked above it —
// so overrides read separately from who is really on call.
const renderEvent = (arg: EventContentArg) => {
  const { kind, color, label } = arg.event.extendedProps
  const base: React.CSSProperties = {
    borderRadius: 4,
    padding: "0 4px",
    fontSize: 11,
    lineHeight: "16px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }

  if (kind === "replaced") {
    return (
      <div
        style={{
          ...base,
          border: `1px dashed ${color}`,
          color,
          background: "transparent",
          textDecoration: "line-through",
          opacity: 0.85,
        }}
      >
        {arg.event.title}
      </div>
    )
  }

  return (
    <div style={{ ...base, background: color, color: "#FFFFFF" }}>
      {arg.event.title}
      {label ? ` (${label})` : ""}
    </div>
  )
}

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

  const events = useMemo<EventInput[]>(() => {
    const result: EventInput[] = []

    ;(schedule?.entries ?? []).forEach((entry) => {
      const isSwap = !!entry.override?.swapGroupId
      const isOverride = !!entry.override
      const replaced =
        isOverride && entry.baseEngineerId !== entry.effectiveEngineerId
      const start = zonedDate(entry.periodStart, timezone)
      const end = zonedDate(entry.periodEnd, timezone) // exclusive for all-day

      const nameFor = (id: string | null) =>
        id ? engineersById[id]?.name ?? "Unknown" : "Unassigned"

      // The originally-scheduled engineer, shown separately (muted) above the
      // real on-call bar only when an override/swap changed the assignment.
      if (replaced) {
        result.push({
          title: nameFor(entry.baseEngineerId),
          start,
          end,
          allDay: true,
          backgroundColor: "transparent",
          borderColor: "transparent",
          extendedProps: {
            kind: "replaced",
            color: engineerColor(entry.baseEngineerId),
            sortKey: 0,
          },
        })
      }

      // Who is really on call.
      result.push({
        title: nameFor(entry.effectiveEngineerId),
        start,
        end,
        allDay: true,
        backgroundColor: "transparent",
        borderColor: "transparent",
        extendedProps: {
          kind: "effective",
          color: engineerColor(entry.effectiveEngineerId),
          label: isSwap ? "swap" : isOverride ? "override" : null,
          sortKey: 1,
        },
      })
    })

    return result
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
        eventContent={renderEvent}
        eventOrder="start,sortKey"
        eventDisplay="block"
        height="auto"
        firstDay={1}
        datesSet={(arg) => setRange({ start: arg.startStr, end: arg.endStr })}
      />
    </Box>
  )
}
