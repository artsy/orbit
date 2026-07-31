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
import { useEngineers, useTeamMembers } from "utils/hooks/useApi"
import { setTeamMembers } from "utils/api/mutations"

interface TeamMembersEditorProps {
  teamId: string
  onChange?: () => void
}

export const TeamMembersEditor: FC<TeamMembersEditorProps> = ({
  teamId,
  onChange,
}) => {
  const {
    data: members,
    isLoading,
    mutate: mutateMembers,
  } = useTeamMembers(teamId)
  const { data: engineers } = useEngineers()
  const { sendToast } = useToasts()

  const [saving, setSaving] = useState(false)
  const [toAdd, setToAdd] = useState("")

  const memberIds = useMemo(
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
    const memberSet = new Set(memberIds)
    return (engineers ?? [])
      .filter((e) => e.active && !memberSet.has(e.id))
      .map((e) => ({ value: e.id, text: e.name }))
  }, [engineers, memberIds])

  const apply = async (nextIds: string[]) => {
    setSaving(true)
    try {
      await setTeamMembers(teamId, { engineerIds: nextIds })
      await mutateMembers()
      onChange?.()
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error updating roster",
        description: error?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = (engineerId: string) => {
    apply(memberIds.filter((id) => id !== engineerId))
  }

  const add = () => {
    if (!toAdd) return
    apply([...memberIds, toAdd])
    setToAdd("")
  }

  return (
    <Box>
      <Flex alignItems="center" gap={1}>
        <Text variant="md">Roster</Text>
        {saving && <Spinner size="small" />}
      </Flex>

      {isLoading ? (
        <Flex justifyContent="center" py={2}>
          <Spinner />
        </Flex>
      ) : memberIds.length === 0 ? (
        <Text variant="sm" color="mono60" mt={1}>
          No engineers on this team yet. Add one below.
        </Text>
      ) : (
        <Box mt={1}>
          {memberIds.map((engineerId) => (
            <Flex
              key={engineerId}
              alignItems="center"
              justifyContent="space-between"
              py={1}
              borderBottom="1px solid"
              borderColor="mono10"
            >
              <Text variant="sm">{nameFor(engineerId)}</Text>

              <Button
                size="small"
                variant="secondaryNeutral"
                disabled={saving}
                onClick={() => remove(engineerId)}
              >
                Remove
              </Button>
            </Flex>
          ))}
        </Box>
      )}

      {addableOptions.length > 0 && (
        <Flex gap={1} mt={2} alignItems="flex-end" maxWidth={400}>
          <Box flex={1}>
            <Select
              title="Add engineer"
              options={[
                { value: "", text: "Select an engineer…" },
                ...addableOptions,
              ]}
              selected={toAdd}
              onSelect={setToAdd}
            />
          </Box>
          <Button size="small" onClick={add} disabled={saving || !toAdd}>
            Add
          </Button>
        </Flex>
      )}
    </Box>
  )
}
