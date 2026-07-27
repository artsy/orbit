import { Box } from "@artsy/palette"
import { RotationSchedule } from "components/schedule/RotationSchedule"
import { useRouter } from "next/router"

export default function RotationPage() {
  const router = useRouter()
  const { id } = router.query

  const rotationId = typeof id === "string" ? id : undefined

  return (
    <Box>
      <RotationSchedule rotationId={rotationId} />
    </Box>
  )
}
