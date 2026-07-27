import { Box, Flex, Spinner, Text } from "@artsy/palette"
import { addDays, formatISO } from "date-fns"
import { FC, useMemo } from "react"
import { Engineer } from "rotations/types"
import {
  useEngineers,
  useMembers,
  useOverrides,
  useRotation,
  useSchedule,
} from "utils/hooks/useApi"
// Authored by WP5 in parallel — may not exist yet in this working copy, but
// will at integration time. Imported per the WP4/WP5 contract.
import { CreateOverrideButton, CreateSwapButton } from "components/overrides"
import { ScheduleTable } from "./ScheduleTable"

interface RotationScheduleProps {
  rotationId?: string
}

const PERIODS_AHEAD = 8
const DEFAULT_CADENCE_DAYS = 7

export const RotationSchedule: FC<RotationScheduleProps> = ({ rotationId }) => {
  const {
    data: rotation,
    error: rotationError,
    isLoading: rotationLoading,
  } = useRotation(rotationId)
  const { error: membersError } = useMembers(rotationId)
  const { data: engineers, error: engineersError } = useEngineers()

  const cadenceDays = rotation?.cadenceDays ?? DEFAULT_CADENCE_DAYS

  const { start, end } = useMemo(() => {
    const today = new Date()
    return {
      start: formatISO(today, { representation: "date" }),
      end: formatISO(addDays(today, PERIODS_AHEAD * cadenceDays), {
        representation: "date",
      }),
    }
  }, [cadenceDays])

  const {
    data: schedule,
    error: scheduleError,
    isLoading: scheduleLoading,
    mutate: mutateSchedule,
  } = useSchedule(rotationId, start, end)
  const { mutate: mutateOverrides } = useOverrides(rotationId)

  const engineersById = useMemo<Record<string, Engineer>>(() => {
    const map: Record<string, Engineer> = {}
    ;(engineers ?? []).forEach((engineer) => {
      map[engineer.id] = engineer
    })
    return map
  }, [engineers])

  if (!rotationId) {
    return (
      <Text variant="sm" color="mono60">
        Select a rotation to see its schedule.
      </Text>
    )
  }

  const error = rotationError || membersError || engineersError || scheduleError

  if (error) {
    return (
      <Text variant="sm" color="red100">
        Something went wrong loading this rotation&apos;s schedule.
      </Text>
    )
  }

  if (rotationLoading || scheduleLoading || !rotation) {
    return (
      <Flex justifyContent="center" py={4}>
        <Spinner />
      </Flex>
    )
  }

  const entries = schedule?.entries ?? []
  const today = new Date()
  const currentEntry = entries.find(
    (entry) =>
      new Date(entry.periodStart) <= today && today < new Date(entry.periodEnd)
  )
  const currentEngineer = currentEntry?.effectiveEngineerId
    ? engineersById[currentEntry.effectiveEngineerId]
    : undefined

  const handleDone = () => {
    mutateSchedule()
    mutateOverrides()
  }

  return (
    <Box>
      <Text variant="lg-display">{rotation.name}</Text>
      <Text variant="sm" color="mono60" mt={0.5}>
        {currentEngineer
          ? `Currently on-call: ${currentEngineer.name}`
          : "No one is currently on-call."}
      </Text>

      <Flex gap={1} my={2}>
        <CreateOverrideButton rotationId={rotationId} onDone={handleDone} />
        <CreateSwapButton rotationId={rotationId} onDone={handleDone} />
      </Flex>

      <ScheduleTable entries={entries} engineersById={engineersById} />
    </Box>
  )
}
