import { Box, Button, Flex, Input, Spinner, Text, useToasts } from "@artsy/palette"
import { useRouter } from "next/router"
import { useState } from "react"
import { TeamMembersEditor } from "components/teams/TeamMembersEditor"
import { deleteTeam, updateTeam } from "utils/api/mutations"
import { useTeam } from "utils/hooks/useApi"

export default function TeamPage() {
  const router = useRouter()
  const { id } = router.query
  const teamId = typeof id === "string" ? id : undefined

  const { data: team, error, isLoading, mutate } = useTeam(teamId)
  const { sendToast } = useToasts()

  const [name, setName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!teamId) return null

  if (isLoading || !team) {
    return (
      <Flex justifyContent="center" py={4}>
        <Spinner />
      </Flex>
    )
  }

  if (error) {
    return (
      <Text variant="sm" color="red100">
        Something went wrong loading this team.
      </Text>
    )
  }

  const nameValue = name ?? team.name
  const nameChanged = nameValue !== team.name && nameValue.trim() !== ""

  const handleRename = async () => {
    setSaving(true)
    try {
      await updateTeam(teamId, { name: nameValue })
      await mutate()
      sendToast({ variant: "success", message: "Team renamed" })
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error renaming team",
        description: error?.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${team.name}? This can't be undone.`)) return

    setDeleting(true)
    try {
      await deleteTeam(teamId)
      sendToast({ variant: "success", message: `${team.name} deleted` })
      router.push("/teams")
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error deleting team",
        description: error?.message,
      })
      setDeleting(false)
    }
  }

  return (
    <Box>
      <Text variant="xl">{team.name}</Text>

      <Flex gap={1} mt={2} alignItems="flex-end" maxWidth={400}>
        <Box flex={1}>
          <Input
            name="teamName"
            title="Team name"
            value={nameValue}
            onChange={(e) => setName(e.target.value)}
          />
        </Box>
        <Button
          size="small"
          variant="secondaryBlack"
          onClick={handleRename}
          disabled={!nameChanged || saving}
          loading={saving}
        >
          Save
        </Button>
      </Flex>

      <Box mt={2}>
        <TeamMembersEditor teamId={teamId} />
      </Box>

      <Box mt={4}>
        <Button
          size="small"
          variant="secondaryNeutral"
          onClick={handleDelete}
          loading={deleting}
        >
          Delete team
        </Button>
      </Box>
    </Box>
  )
}
