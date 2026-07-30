import { Box, Flex, Pill, Text } from "@artsy/palette"
import { format, parseISO } from "date-fns"
import Link from "next/link"
import { FC } from "react"
import { EventLogEntry } from "rotations/types"

interface EventLogTableProps {
  events: EventLogEntry[]
}

// "rotation.created" -> "Rotation created"
const humanizeAction = (action: string): string => {
  const label = action.replace(".", " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const EventLogTable: FC<EventLogTableProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <Text variant="sm" color="mono60">
        No events recorded yet.
      </Text>
    )
  }

  return (
    <Box>
      <Flex
        py={0.5}
        borderBottom="1px solid"
        borderColor="mono30"
        alignItems="center"
      >
        <Box width="15%">
          <Text variant="xs" color="mono60">
            When
          </Text>
        </Box>
        <Box width="20%">
          <Text variant="xs" color="mono60">
            Actor
          </Text>
        </Box>
        <Box width="15%">
          <Text variant="xs" color="mono60">
            Action
          </Text>
        </Box>
        <Box width="20%">
          <Text variant="xs" color="mono60">
            Rotation
          </Text>
        </Box>
        <Box width="30%">
          <Text variant="xs" color="mono60">
            Summary
          </Text>
        </Box>
      </Flex>

      {events.map((event) => (
        <Flex
          key={event.id}
          py={1}
          alignItems="center"
          borderBottom="1px solid"
          borderColor="mono10"
        >
          <Box width="15%">
            <Text variant="xs" color="mono60">
              {/* Absolute audit timestamp — shown in the viewer's local time,
                  unlike the rotation-timezone-relative schedule table. */}
              {format(parseISO(event.createdAt), "MMM d, HH:mm")}
            </Text>
          </Box>

          <Box width="20%">
            <Text variant="sm">{event.actorEmail}</Text>
          </Box>

          <Box width="15%">
            <Pill variant="badge">{humanizeAction(event.action)}</Pill>
          </Box>

          <Box width="20%">
            {event.rotationId ? (
              <Link
                href={`/rotations/${event.rotationId}`}
                style={{ color: "inherit" }}
              >
                <Text variant="sm">{event.rotationName}</Text>
              </Link>
            ) : (
              <Text variant="sm" color="mono60">
                {event.rotationName ?? "—"}
              </Text>
            )}
          </Box>

          <Box width="30%">
            <Text variant="sm">{event.summary}</Text>
          </Box>
        </Flex>
      ))}
    </Box>
  )
}
