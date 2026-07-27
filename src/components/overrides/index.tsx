import { Button, ModalDialog } from "@artsy/palette"
import { useEffect, useState } from "react"
import { Engineer } from "rotations/types"
import { OverrideForm } from "./OverrideForm"
import { SwapForm } from "./SwapForm"

/** Loads active + inactive engineers for use in the override/swap Selects. */
function useEngineers(): Engineer[] {
  const [engineers, setEngineers] = useState<Engineer[]>([])

  useEffect(() => {
    let cancelled = false

    fetch("/api/engineers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Engineer[]) => {
        if (!cancelled) setEngineers(data)
      })
      .catch(() => {
        if (!cancelled) setEngineers([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  return engineers
}

export interface CreateOverrideButtonProps {
  rotationId: string
  onDone?: () => void
}

export const CreateOverrideButton: React.FC<CreateOverrideButtonProps> = ({
  rotationId,
  onDone,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const engineers = useEngineers()

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Add override</Button>

      {isOpen && (
        <ModalDialog
          title="Add override"
          onClose={() => setIsOpen(false)}
          width={["100%", 500]}
        >
          <OverrideForm
            rotationId={rotationId}
            engineers={engineers}
            onCancel={() => setIsOpen(false)}
            onDone={() => {
              setIsOpen(false)
              onDone?.()
            }}
          />
        </ModalDialog>
      )}
    </>
  )
}

export interface CreateSwapButtonProps {
  rotationId: string
  onDone?: () => void
}

export const CreateSwapButton: React.FC<CreateSwapButtonProps> = ({
  rotationId,
  onDone,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const engineers = useEngineers()

  return (
    <>
      <Button variant="secondaryBlack" onClick={() => setIsOpen(true)}>
        Swap shifts
      </Button>

      {isOpen && (
        <ModalDialog
          title="Swap shifts"
          onClose={() => setIsOpen(false)}
          width={["100%", 500]}
        >
          <SwapForm
            rotationId={rotationId}
            engineers={engineers}
            onCancel={() => setIsOpen(false)}
            onDone={() => {
              setIsOpen(false)
              onDone?.()
            }}
          />
        </ModalDialog>
      )}
    </>
  )
}
