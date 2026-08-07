import { Box, Text } from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import type { EventContentArg, EventInput } from "@fullcalendar/core"
import dayGridPlugin from "@fullcalendar/daygrid"
import FullCalendar from "@fullcalendar/react"
import { format, parseISO } from "date-fns"
import { FC, useMemo, useState } from "react"
import { Engineer, EngineerPattern, ScheduleEntry } from "rotations/types"
import { colorForEngineer } from "rotations/colors"
import { patternBarStyle, SparkleOverlay, SparkleStyles } from "./sparkle"
import { useSchedule } from "utils/hooks/useApi"

// Fully custom event rendering (see events builder): the covering engineer is a
// solid colored bar; an overridden period also gets a separate, muted
// struck-through bar for the originally scheduled engineer, stacked above it —
// so overrides read separately from who is really on call. The effective bar
// also carries the engineer's chosen animated pattern, if any.
const renderEvent = (arg: EventContentArg) => {
  const { kind, color, label, clickable, pattern } = arg.event
    .extendedProps as {
    kind: string
    color: string
    label: string | null
    clickable: boolean
    pattern: EngineerPattern | null
  }
  const base: React.CSSProperties = {
    position: "relative",
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

  const { className, style: patternStyle } = patternBarStyle(pattern, color)

  return (
    <div
      className={
        [clickable ? "orbit-event-clickable" : "", className ?? ""]
          .filter(Boolean)
          .join(" ") || undefined
      }
      style={{
        ...base,
        background: color,
        color: "#FFFFFF",
        cursor: clickable ? "pointer" : undefined,
        ...patternStyle,
      }}
    >
      <SparkleOverlay pattern={pattern} />
      {arg.event.title}
      {label ? ` (${label})` : ""}
    </div>
  )
}

interface RotationCalendarProps {
  rotationId: string
  timezone: string
  engineersById: Record<string, Engineer>
  /** Tapping the on-call (main person) bar of a normal period requests a swap. */
  onSwapRequest?: (entry: ScheduleEntry) => void
  /** Tapping the on-call bar of an overridden/swapped period requests actions. */
  onOverrideAction?: (entry: ScheduleEntry) => void
}

// Calendar date (YYYY-MM-DD) of an instant, in the rotation's timezone.
const zonedDate = (iso: string, timezone: string) =>
  format(new TZDate(parseISO(iso).getTime(), timezone), "yyyy-MM-dd")

export const RotationCalendar: FC<RotationCalendarProps> = ({
  rotationId,
  timezone,
  engineersById,
  onSwapRequest,
  onOverrideAction,
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
        id ? (engineersById[id]?.name ?? "Unknown") : "Unassigned"

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
            color: colorForEngineer(
              engineersById[entry.baseEngineerId ?? ""],
              entry.baseEngineerId
            ),
            sortKey: 0,
          },
        })
      }

      // Who is really on call.
      const effectiveEngineer = entry.effectiveEngineerId
        ? engineersById[entry.effectiveEngineerId]
        : undefined
      result.push({
        title: nameFor(entry.effectiveEngineerId),
        start,
        end,
        allDay: true,
        backgroundColor: "transparent",
        borderColor: "transparent",
        extendedProps: {
          kind: "effective",
          color: colorForEngineer(effectiveEngineer, entry.effectiveEngineerId),
          pattern: effectiveEngineer?.pattern ?? null,
          label: isSwap ? "swap" : isOverride ? "override" : null,
          sortKey: 1,
          clickable: !!(onSwapRequest || onOverrideAction),
          entry,
        },
      })
    })

    return result
  }, [schedule, engineersById, timezone, onSwapRequest, onOverrideAction])

  return (
    <Box>
      <SparkleStyles />
      <style>{`
        .fc .fc-day-sat, .fc .fc-day-sun { background: rgba(0, 0, 0, 0.03); }
        .fc .fc-day-today { background: rgba(0, 0, 0, 0.06) !important; box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.25); }
        .orbit-event-clickable { transition: filter 0.1s ease; }
        .orbit-event-clickable:hover { filter: brightness(0.9); }
      `}</style>
      {isLoading && (
        <Text variant="xs" color="mono60" mb={0.5}>
          Updating…
        </Text>
      )}
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridTwoWeek,dayGridMonth",
        }}
        views={{
          dayGridTwoWeek: {
            type: "dayGrid",
            duration: { weeks: 2 },
            buttonText: "2 weeks",
          },
          dayGridMonth: {
            buttonText: "Month",
          },
        }}
        events={events}
        eventContent={renderEvent}
        eventOrder="start,sortKey"
        eventClick={(arg) => {
          const props = arg.event.extendedProps
          if (props.kind === "effective" && props.entry) {
            const entry = props.entry as ScheduleEntry
            if (entry.override) {
              onOverrideAction?.(entry)
            } else {
              onSwapRequest?.(entry)
            }
          }
        }}
        eventDisplay="block"
        height="auto"
        firstDay={1}
        datesSet={(arg) => setRange({ start: arg.startStr, end: arg.endStr })}
      />
    </Box>
  )
}
