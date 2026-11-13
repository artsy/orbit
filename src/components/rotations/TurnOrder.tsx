import { Box, Flex, Pill, Text } from "@artsy/palette"
import { FC } from "react"
import { pickNextTurn, todayInTimezone } from "rotations/logic"
import { Engineer, Override, Rotation, RotationMember } from "rotations/types"
import { useEngineers } from "utils/hooks/useApi"

/**
 * Who is next up. The effective engineer can be an override's replacement who
 * is not a member, so the name comes from the engineers list or the override.
 */
export const findNextUp = (
  rotation: Rotation,
  members: RotationMember[],
  overrides: Override[],
  engineers: Engineer[]
): { engineerId: string; name: string } | null => {
  const pick = pickNextTurn(
    members,
    rotation.nextPosition,
    overrides,
    todayInTimezone(rotation.timezone, new Date())
  )
  if (!pick) return null

  const id = pick.effectiveEngineerId
  const engineer =
    engineers.find((e) => e.id === id) ??
    members.find((m) => m.engineerId === id)?.engineer ??
    overrides.find((o) => o.replacementEngineerId === id)?.replacementEngineer

  return { engineerId: id, name: engineer?.name ?? "Unknown engineer" }
}

interface TurnOrderProps {
  rotation: Rotation
  members: RotationMember[]
  overrides: Override[]
}

export const TurnOrder: FC<TurnOrderProps> = ({
  rotation,
  members,
  overrides,
}) => {
  const { data: engineers } = useEngineers()

  const nextUp = findNextUp(rotation, members, overrides, engineers ?? [])
  const ordered = [...members].sort((a, b) => a.position - b.position)

  return (
    <Box data-testid="turn-order">
      <Text variant="md">Turn order</Text>
      <Text variant="sm" color="mono60" mt={0.5}>
        {nextUp ? `Next up: ${nextUp.name}` : "No one is next up."}
      </Text>

      {ordered.length > 0 && (
        <Box as="ol" mt={1} p={0} style={{ listStyle: "none" }}>
          {ordered.map((member, index) => (
            <Flex
              as="li"
              key={member.id}
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
                <Text
                  variant="sm"
                  color={member.engineer?.active === false ? "mono60" : "mono100"}
                >
                  {member.engineer?.name ?? "Unknown engineer"}
                  {member.engineer?.active === false ? " (inactive)" : ""}
                </Text>
              </Flex>

              {member.engineerId === nextUp?.engineerId && (
                <Pill variant="badge">Next up</Pill>
              )}
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  )
}
