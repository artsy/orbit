import { Box, Flex, Pill, Text } from "@artsy/palette"
import { FC } from "react"
import { pickNextTurn } from "rotations/logic"
import { Engineer, Rotation, RotationMember } from "rotations/types"
import { useEngineers } from "utils/hooks/useApi"

export const findNextUp = (
  rotation: Rotation,
  members: RotationMember[],
  engineers: Engineer[]
): { engineerId: string; name: string } | null => {
  const pick = pickNextTurn(members, rotation.nextPosition)
  if (!pick) return null

  const engineer =
    engineers.find((e) => e.id === pick.engineerId) ??
    members.find((m) => m.engineerId === pick.engineerId)?.engineer

  return {
    engineerId: pick.engineerId,
    name: engineer?.name ?? "Unknown engineer",
  }
}

interface TurnOrderProps {
  rotation: Rotation
  members: RotationMember[]
}

export const TurnOrder: FC<TurnOrderProps> = ({ rotation, members }) => {
  const { data: engineers } = useEngineers()

  const nextUp = findNextUp(rotation, members, engineers ?? [])
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
                  color={
                    member.engineer?.active === false ? "mono60" : "mono100"
                  }
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
