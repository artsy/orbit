import { Box, Flex, Separator, Spacer, Spinner, Text } from "@artsy/palette"
import { addDays, formatISO, parseISO } from "date-fns"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { FC, useMemo, useState } from "react"
import { Engineer, ScheduleEntry } from "rotations/types"
import {
  useEngineers,
  useMembers,
  useOverrides,
  useRotation,
  useSchedule,
} from "utils/hooks/useApi"
import {
  CreateOverrideButton,
  CreateSwapButton,
  SwapModal,
} from "components/overrides"
import { SwapFormValues } from "components/overrides/SwapForm"
import { OverridesList } from "components/overrides/OverridesList"
import { MembersEditor } from "components/members/MembersEditor"
import { ScheduleTable } from "./ScheduleTable"

// FullCalendar touches the DOM, so load it client-side only.
const RotationCalendar = dynamic(
  () => import("./RotationCalendar").then((m) => m.RotationCalendar),
  {
    ssr: false,
    loading: () => (
      <Flex justifyContent="center" py={4}>
        <Spinner />
      </Flex>
    ),
  }
)

interface RotationScheduleProps {
  rotationId?: string
}

const PERIODS_AHEAD = 8
const DEFAULT_CADENCE_DAYS = 7

const findMyNextShift = (
  entries: ScheduleEntry[],
  engineerId: string
): ScheduleEntry | undefined => {
  const now = Date.now()
  return entries
    .filter(
      (entry) =>
        entry.baseEngineerId === engineerId &&
        parseISO(entry.periodEnd).getTime() > now
    )
    .sort(
      (a, b) =>
        parseISO(a.periodStart).getTime() - parseISO(b.periodStart).getTime()
    )[0]
}

export const RotationSchedule: FC<RotationScheduleProps> = ({ rotationId }) => {
  const {
    data: rotation,
    error: rotationError,
    isLoading: rotationLoading,
  } = useRotation(rotationId)
  const { error: membersError, mutate: mutateMembers } = useMembers(rotationId)
  const { data: engineers, error: engineersError } = useEngineers()
  const session = useSession()
  const myEmail = session.data?.user?.email
  const [swapPrefill, setSwapPrefill] = useState<
    Partial<SwapFormValues> | undefined
  >(undefined)
  const [swapOpen, setSwapOpen] = useState(false)

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

  const myEngineer = (engineers ?? []).find(
    (e) => e.email?.toLowerCase() === myEmail?.toLowerCase()
  )

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
    mutateMembers()
  }

  const handleRowClick = (entry: ScheduleEntry) => {
    const myNext = myEngineer ? findMyNextShift(entries, myEngineer.id) : undefined
    setSwapPrefill({
      engineerAId: entry.baseEngineerId ?? "",
      dateA: entry.periodStart,
      engineerBId: myEngineer?.id ?? "",
      dateB: myNext?.periodStart ?? "",
    })
    setSwapOpen(true)
  }

  return (
    <Box>
      <Text variant="lg-display">{rotation.name}</Text>
      {rotation.description && (
        <Text variant="sm" mt={0.5}>
          {rotation.description}
        </Text>
      )}
      <Text variant="sm" color="mono60" mt={0.5}>
        {currentEngineer
          ? `Currently on-call: ${currentEngineer.name}`
          : "No one is currently on-call."}
      </Text>

      <Flex gap={1} my={2}>
        <CreateOverrideButton rotationId={rotationId} onDone={handleDone} />
        <CreateSwapButton
          rotationId={rotationId}
          engineers={engineers ?? []}
          entries={entries}
          timezone={rotation.timezone}
          onDone={handleDone}
        />
      </Flex>

      <SwapModal
        rotationId={rotationId}
        engineers={engineers ?? []}
        entries={entries}
        timezone={rotation.timezone}
        isOpen={swapOpen}
        onClose={() => setSwapOpen(false)}
        onDone={handleDone}
        initialValues={swapPrefill}
      />

      <RotationCalendar
        rotationId={rotationId}
        timezone={rotation.timezone}
        engineersById={engineersById}
      />

      <Spacer y={4} />

      <Text variant="md">Schedule list</Text>
      <Spacer y={1} />
      <ScheduleTable
        entries={entries}
        engineersById={engineersById}
        timezone={rotation.timezone}
        onRowClick={handleRowClick}
      />

      <Spacer y={4} />
      <Separator />
      <Spacer y={4} />

      <OverridesList
        rotationId={rotationId}
        engineersById={engineersById}
        onChange={handleDone}
      />

      <Spacer y={4} />
      <Separator />
      <Spacer y={4} />

      <MembersEditor rotationId={rotationId} onChange={handleDone} />
    </Box>
  )
}
