import {
  Box,
  Button,
  Flex,
  ModalDialog,
  Separator,
  Spacer,
  Spinner,
  Text,
  useToasts,
} from "@artsy/palette"
import { addDays, formatISO, parseISO } from "date-fns"
import { useSWRConfig } from "swr"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { FC, useMemo, useState } from "react"
import { Engineer, Override, ScheduleEntry } from "rotations/types"
import {
  useEngineers,
  useMembers,
  useOverrides,
  useRotation,
  useSchedule,
} from "utils/hooks/useApi"
import { deleteOverride } from "utils/api/mutations"
import { EditRotationModal } from "components/rotations/EditRotationModal"
import {
  CreateOverrideButton,
  CreateSwapButton,
  OverrideModal,
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
    mutate: mutateRotation,
  } = useRotation(rotationId)
  const { error: membersError, mutate: mutateMembers } = useMembers(rotationId)
  const { data: engineers, error: engineersError } = useEngineers()
  const { mutate: globalMutate } = useSWRConfig()
  const { sendToast } = useToasts()
  const session = useSession()
  const myEmail = session.data?.user?.email
  const [swapPrefill, setSwapPrefill] = useState<
    Partial<SwapFormValues> | undefined
  >(undefined)
  const [swapOpen, setSwapOpen] = useState(false)
  // Override/swap actions triggered from a calendar bar.
  const [actionEntry, setActionEntry] = useState<ScheduleEntry | null>(null)
  const [editingOverride, setEditingOverride] = useState<Override | null>(null)
  const [editingSwap, setEditingSwap] = useState<{
    prefill: Partial<SwapFormValues>
    replaceIds: string[]
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

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
  } = useSchedule(rotationId, start, end)
  const { data: overrides, mutate: mutateOverrides } = useOverrides(rotationId)

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
    mutateOverrides()
    mutateMembers()
    // Revalidate every schedule window for this rotation — the list and the
    // calendar use different SWR keys (different date ranges), so a single
    // mutateSchedule() would miss the calendar's view.
    globalMutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(`/api/rotations/${rotationId}/schedule`)
    )
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

  const handleOverrideAction = (entry: ScheduleEntry) => {
    if (entry.override) setActionEntry(entry)
  }

  const groupFor = (override: Override): Override[] =>
    override.swapGroupId
      ? (overrides ?? []).filter((o) => o.swapGroupId === override.swapGroupId)
      : []

  const startModify = () => {
    const ov = actionEntry?.override
    if (!ov) return

    const group = groupFor(ov)
    if (ov.swapGroupId && group.length === 2) {
      const [first, second] = group
      setEditingSwap({
        prefill: {
          engineerAId: first.originalEngineerId ?? "",
          dateA: first.startDate,
          engineerBId: second.originalEngineerId ?? "",
          dateB: second.startDate,
          reason: first.reason ?? "",
        },
        replaceIds: group.map((o) => o.id),
      })
    } else {
      setEditingOverride(ov)
    }
    setActionEntry(null)
  }

  const handleDeleteAction = async () => {
    const ov = actionEntry?.override
    if (!ov) return
    setDeleting(true)
    try {
      const ids = ov.swapGroupId
        ? groupFor(ov).map((o) => o.id)
        : [ov.id]
      await Promise.all(ids.map((id) => deleteOverride(id)))
      sendToast({
        variant: "success",
        message: ov.swapGroupId ? "Swap removed" : "Override removed",
      })
      setActionEntry(null)
      handleDone()
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error removing",
        description: error?.message,
      })
    } finally {
      setDeleting(false)
    }
  }

  const nameFor = (id: string | null) =>
    id ? engineersById[id]?.name ?? "Unknown engineer" : "Unassigned"

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
        <Button variant="secondaryBlack" onClick={() => setEditOpen(true)}>
          Edit rotation
        </Button>
      </Flex>

      <EditRotationModal
        rotation={rotation}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onDone={() => {
          mutateRotation()
          handleDone()
          globalMutate("/api/rotations")
        }}
      />

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
        onSwapRequest={handleRowClick}
        onOverrideAction={handleOverrideAction}
      />

      {actionEntry?.override && (
        <ModalDialog
          title={actionEntry.override.swapGroupId ? "Swap" : "Override"}
          onClose={() => setActionEntry(null)}
          width={["100%", 460]}
        >
          <Text variant="sm">
            {nameFor(actionEntry.effectiveEngineerId)} is covering{" "}
            {nameFor(actionEntry.baseEngineerId)}&apos;s shift.
          </Text>
          {actionEntry.override.reason && (
            <Text variant="xs" color="mono60" mt={0.5}>
              {actionEntry.override.reason}
            </Text>
          )}

          <Flex justifyContent="flex-end" gap={1} mt={2}>
            <Button
              variant="secondaryBlack"
              onClick={() => setActionEntry(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="secondaryNeutral"
              onClick={handleDeleteAction}
              loading={deleting}
            >
              Delete
            </Button>
            <Button onClick={startModify} disabled={deleting}>
              Modify
            </Button>
          </Flex>
        </ModalDialog>
      )}

      {editingOverride && (
        <OverrideModal
          rotationId={rotationId}
          engineers={engineers ?? []}
          override={editingOverride}
          isOpen
          onClose={() => setEditingOverride(null)}
          onDone={handleDone}
        />
      )}

      {editingSwap && (
        <SwapModal
          rotationId={rotationId}
          engineers={engineers ?? []}
          entries={entries}
          timezone={rotation.timezone}
          isOpen
          initialValues={editingSwap.prefill}
          replaceOverrideIds={editingSwap.replaceIds}
          onClose={() => setEditingSwap(null)}
          onDone={handleDone}
        />
      )}

      <Spacer y={4} />

      <Text variant="md">Schedule list</Text>
      <Text variant="xs" color="mono60">
        Tap on a row to swap
      </Text>
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
