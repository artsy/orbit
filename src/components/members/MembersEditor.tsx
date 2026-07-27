import {
  Box,
  Button,
  Flex,
  Select,
  Spinner,
  Text,
  useToasts,
} from "@artsy/palette"
import { FC, useMemo, useState } from "react"
import { useEngineers, useMembers } from "utils/hooks/useApi"
import { setMembers } from "utils/api/mutations"

interface MembersEditorProps {
  rotationId: string
  /** Called after the membership changes so callers can revalidate. */
  onChange?: () => void
}

export const MembersEditor: FC<MembersEditorProps> = ({
  rotationId,
  onChange,
}) => {
  const {
    data: members,
    isLoading,
    mutate: mutateMembers,
  } = useMembers(rotationId)
  const { data: engineers } = useEngineers()
  const { sendToast } = useToasts()

  const [saving, setSaving] = useState(false)
  const [toAdd, setToAdd] = useState("")

  // Members are returned ordered by position.
  const orderedIds = useMemo(
    () => (members ?? []).map((member) => member.engineerId),
    [members]
  )

  const nameFor = useMemo(() => {
    const map: Record<string, string> = {}
    ;(engineers ?? []).forEach((e) => (map[e.id] = e.name))
    ;(members ?? []).forEach((m) => {
      if (m.engineer) map[m.engineerId] = m.engineer.name
    })
    return (id: string) => map[id] ?? "Unknown engineer"
  }, [engineers, members])

  const addableOptions = useMemo(() => {
    const memberSet = new Set(orderedIds)
    return (engineers ?? [])
      .filter((e) => e.active && !memberSet.has(e.id))
      .map((e) => ({ value: e.id, text: e.name }))
  }, [engineers, orderedIds])

  const apply = async (nextIds: string[]) => {
    setSaving(true)
    try {
      await setMembers(rotationId, { engineerIds: nextIds })
      await mutateMembers()
      onChange?.()
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error updating members",
        description: error?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const next = [...orderedIds]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    apply(next)
  }

  const remove = (engineerId: string) => {
    apply(orderedIds.filter((id) => id !== engineerId))
  }

  const add = () => {
    if (!toAdd) return
    apply([...orderedIds, toAdd])
    setToAdd("")
  }

  return (
    <Box>
      <Flex alignItems="center" gap={1}>
        <Text variant="md">On-call order</Text>
        {saving && <Spinner size="small" />}
      </Flex>

      <Text variant="xs" color="mono60" mt={0.5}>
        Engineers rotate top to bottom. Deactivated engineers are skipped
        automatically.
      </Text>

      {isLoading ? (
        <Flex justifyContent="center" py={2}>
          <Spinner />
        </Flex>
      ) : orderedIds.length === 0 ? (
        <Text variant="sm" color="mono60" mt={1}>
          No engineers in this rotation yet. Add one below.
        </Text>
      ) : (
        <Box mt={1}>
          {orderedIds.map((engineerId, index) => (
            <Flex
              key={engineerId}
              alignItems="center"
              justifyContent="space-between"
              py={1}
              borderBottom="1px solid"
              borderColor="mono10"
            >
              <Flex alignItems="center" gap={1}>
                <Text variant="xs" color="mono60" width={20}>
                  {index + 1}.
                </Text>
                <Text variant="sm">{nameFor(engineerId)}</Text>
              </Flex>

              <Flex gap={0.5}>
                <Button
                  size="small"
                  variant="secondaryNeutral"
                  disabled={saving || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${nameFor(engineerId)} up`}
                >
                  ↑
                </Button>
                <Button
                  size="small"
                  variant="secondaryNeutral"
                  disabled={saving || index === orderedIds.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${nameFor(engineerId)} down`}
                >
                  ↓
                </Button>
                <Button
                  size="small"
                  variant="secondaryNeutral"
                  disabled={saving}
                  onClick={() => remove(engineerId)}
                >
                  Remove
                </Button>
              </Flex>
            </Flex>
          ))}
        </Box>
      )}

      {addableOptions.length > 0 && (
        <Flex gap={1} mt={2} alignItems="flex-end" maxWidth={400}>
          <Box flex={1}>
            <Select
              title="Add engineer"
              options={[{ value: "", text: "Select an engineer…" }, ...addableOptions]}
              selected={toAdd}
              onSelect={setToAdd}
            />
          </Box>
          <Button
            size="small"
            onClick={add}
            disabled={saving || !toAdd}
          >
            Add
          </Button>
        </Flex>
      )}
    </Box>
  )
}
