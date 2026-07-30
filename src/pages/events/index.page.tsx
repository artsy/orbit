import { Box, Flex, Spinner, Text } from "@artsy/palette"
import { EventLogTable } from "components/events/EventLogTable"
import { useEvents } from "utils/hooks/useApi"

export default function EventLogPage() {
  const { data: events, error, isLoading } = useEvents()

  return (
    <Box>
      <Text variant="xl">Event Log</Text>
      <Text variant="sm" color="mono60" mt={0.5}>
        Recent operations across rotations, engineers, and overrides — who did
        what, and when.
      </Text>

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
