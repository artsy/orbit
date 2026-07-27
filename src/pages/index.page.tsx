import { Box, Button, Flex, Spinner, Text } from "@artsy/palette"
import { RotationSchedule } from "components/schedule/RotationSchedule"
import Link from "next/link"
import { useRotations } from "utils/hooks/useApi"

export default function HomePage() {
  const { data: rotations, error, isLoading } = useRotations()

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center">
        <Text variant="xl">Engineer rotation</Text>

        <Link href="/rotations/new" style={{ textDecoration: "none" }}>
          <Button size="small">New rotation</Button>
        </Link>
      </Flex>

      {isLoading && (
        <Flex justifyContent="center" py={4}>
          <Spinner />
        </Flex>
      )}

      {error && (
        <Text variant="sm" color="red100" mt={1}>
          Couldn&apos;t load rotations. Please try again later.
        </Text>
      )}

      {!isLoading && !error && (!rotations || rotations.length === 0) && (
        <Text variant="sm" color="mono60" mt={1}>
          No rotations yet. Use “New rotation” to create one.
        </Text>
      )}

      {!isLoading && !error && rotations && rotations.length > 0 && (
        <Box mt={2}>
          <Text variant="md">Rotations</Text>

          <Box mt={1}>
            {rotations.map((rotation) => (
              <Box key={rotation.id} py={0.5}>
                <Link
                  href={`/rotations/${rotation.id}`}
                  style={{ color: "inherit" }}
                >
                  <Text variant="sm-display">{rotation.name}</Text>
                </Link>
              </Box>
            ))}
          </Box>

          {rotations.length === 1 && (
            <Box mt={4}>
              <RotationSchedule rotationId={rotations[0].id} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
