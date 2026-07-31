import { Box, Flex, Spinner, Text } from "@artsy/palette"
import { EventLogTable } from "components/events/EventLogTable"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEvents, useRotation } from "utils/hooks/useApi"

export default function EventLogPage() {
  const router = useRouter()
  const rotationId =
    typeof router.query.rotationId === "string"
      ? router.query.rotationId
      : undefined

  const { data: events, error, isLoading } = useEvents(rotationId)
  const { data: rotation } = useRotation(rotationId)

  return (
    <Box>
      <Text variant="xl">
        {rotationId ? `Event log — ${rotation?.name ?? "…"}` : "Event Log"}
      </Text>

      {rotationId ? (
        <Text variant="sm" color="mono60" mt={0.5}>
          Recent operations on this rotation — who did what, and when.{" "}
          <Link href={`/rotations/${rotationId}`} style={{ color: "inherit" }}>
            Back to rotation
          </Link>
        </Text>
      ) : (
        <Text variant="sm" color="mono60" mt={0.5}>
          Recent operations across rotations, engineers, and overrides — who did
          what, and when.
        </Text>
      )}

      {isLoading && (
        <Flex justifyContent="center" py={4}>
          <Spinner />
        </Flex>
      )}

      {error && (
        <Text variant="sm" color="red100" mt={1}>
          Couldn&apos;t load the event log. Please try again later.
        </Text>
      )}

      {!isLoading && !error && (
        <Box mt={2}>
          <EventLogTable events={events ?? []} />
        </Box>
      )}
    </Box>
  )
}
