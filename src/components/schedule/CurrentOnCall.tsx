import { Box, Flex, Text } from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import { addDays, format, formatISO, parseISO } from "date-fns"
import { useSession } from "next-auth/react"
import { FC, useMemo } from "react"
import { Rotation } from "rotations/types"
import { colorForEngineer } from "rotations/colors"
import { SparkleMark, SparkleStyles } from "./sparkle"
import { useEngineers, useSchedule } from "utils/hooks/useApi"

interface CurrentOnCallProps {
  rotation: Rotation
}

/**
 * Compact "X is on call until …" preview for the rotations list. Shows "You
 * are on call …" when the current on-call engineer's email matches the
 * signed-in user. Full schedule details live on the rotation's own page.
 */
export const CurrentOnCall: FC<CurrentOnCallProps> = ({ rotation }) => {
  const { start, end } = useMemo(() => {
    const today = new Date()
    return {
      start: formatISO(today, { representation: "date" }),
      end: formatISO(addDays(today, rotation.cadenceDays + 1), {
        representation: "date",
      }),
    }
  }, [rotation.cadenceDays])

  const { data: schedule } = useSchedule(rotation.id, start, end)
  const { data: engineers } = useEngineers()
  const session = useSession()
  const myEmail = session.data?.user?.email

  if (!schedule) return null

  const now = new Date()
  const current = schedule.entries.find(
    (entry) =>
      parseISO(entry.periodStart) <= now && now < parseISO(entry.periodEnd)
  )

  if (!current || !current.effectiveEngineerId) {
    return (
      <Text variant="xs" color="mono60">
        No one is currently on call.
      </Text>
    )
  }

  const engineer = (engineers ?? []).find(
    (candidate) => candidate.id === current.effectiveEngineerId
  )
  const isMe =
    !!engineer?.email &&
    !!myEmail &&
    engineer.email.toLowerCase() === myEmail.toLowerCase()

  const until = format(
    new TZDate(parseISO(current.periodEnd).getTime(), rotation.timezone),
    "MMM d, yyyy 'at' h:mm a"
  )

  const color = colorForEngineer(engineer, current.effectiveEngineerId)

  return (
    <Flex alignItems="center" gap={0.5}>
      <SparkleStyles />
      <Box
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          backgroundColor: color,
        }}
      />
      <Text variant="xs" color={isMe ? "blue100" : "mono60"}>
        {isMe ? "You are" : `${engineer?.name ?? "Someone"} is`} on call until{" "}
        {until}
      </Text>
      <SparkleMark pattern={engineer?.pattern} color={color} />
    </Flex>
  )
}
