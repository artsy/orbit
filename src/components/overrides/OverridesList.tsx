import { Box, Button, Flex, Pill, Spinner, Text, useToasts } from "@artsy/palette"
import { format, parseISO, subDays } from "date-fns"
import { FC, useState } from "react"
import { Engineer } from "rotations/types"
import { useOverrides } from "utils/hooks/useApi"
import { deleteOverride } from "utils/api/mutations"

interface OverridesListProps {
  rotationId: string
  engineersById: Record<string, Engineer>
  onChange?: () => void
}

export const OverridesList: FC<OverridesListProps> = ({
  rotationId,
  engineersById,
  onChange,
}) => {
  const { data: overrides, isLoading, mutate } = useOverrides(rotationId)
  const { sendToast } = useToasts()
  const [removingId, setRemovingId] = useState<string | null>(null)

  const nameFor = (id: string) =>
    engineersById[id]?.name ?? "Unknown engineer"

  const remove = async (id: string) => {
    setRemovingId(id)
    try {
      await deleteOverride(id)
      await mutate()
      onChange?.()
      sendToast({ variant: "success", message: "Override removed" })
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error removing override",
        description: error?.message,
      })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Box>
      <Text variant="md">Overrides &amp; swaps</Text>

      {isLoading ? (
        <Flex justifyContent="center" py={2}>
          <Spinner />
        </Flex>
      ) : !overrides || overrides.length === 0 ? (
        <Text variant="sm" color="mono60" mt={1}>
          No active overrides.
        </Text>
      ) : (
        <Box mt={1}>
          {overrides.map((override) => (
            <Flex
              key={override.id}
              alignItems="center"
              justifyContent="space-between"
              py={1}
              borderBottom="1px solid"
              borderColor="mono10"
            >
              <Box>
                <Flex alignItems="center" gap={1}>
                  <Text variant="sm">
                    {format(parseISO(override.startDate), "MMM d")} –{" "}
                    {format(subDays(parseISO(override.endDate), 0), "MMM d")}
                  </Text>
                  <Pill variant="badge">
                    {override.swapGroupId ? "swap" : "override"}
                  </Pill>
                </Flex>
                <Text variant="xs" color="mono60">
                  Covered by {nameFor(override.replacementEngineerId)}
                  {override.reason ? ` — ${override.reason}` : ""}
                </Text>
              </Box>

              <Button
                size="small"
                variant="secondaryNeutral"
                loading={removingId === override.id}
                disabled={removingId !== null}
                onClick={() => remove(override.id)}
              >
                Remove
              </Button>
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  )
}
