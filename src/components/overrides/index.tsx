import { Button, ModalDialog } from "@artsy/palette"
import { useEffect, useState } from "react"
import { Engineer, Override, ScheduleEntry } from "rotations/types"
import { OverrideForm } from "./OverrideForm"
import { SwapForm, SwapFormValues } from "./SwapForm"

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

export interface SwapModalProps {
  rotationId: string
  engineers: Engineer[]
  entries: ScheduleEntry[]
  timezone: string
  isOpen: boolean
  onClose: () => void
  onDone?: () => void
  initialValues?: Partial<SwapFormValues>
  /** When set, the modal edits the existing swap made of these override ids. */
  replaceOverrideIds?: string[]
}

export const SwapModal: React.FC<SwapModalProps> = ({
  rotationId,
  engineers,
  entries,
  timezone,
  isOpen,
  onClose,
  onDone,
  initialValues,
  replaceOverrideIds,
}) => {
  if (!isOpen) return null

  return (
    <ModalDialog
      title={replaceOverrideIds?.length ? "Edit swap" : "Swap shifts"}
      onClose={onClose}
      width={["100%", 500]}
    >
      <SwapForm
        rotationId={rotationId}
        engineers={engineers}
        entries={entries}
        timezone={timezone}
        initialValues={initialValues}
        replaceOverrideIds={replaceOverrideIds}
        onCancel={onClose}
        onDone={() => {
          onClose()
          onDone?.()
        }}
      />
    </ModalDialog>
  )
}

export interface OverrideModalProps {
  rotationId: string
  engineers: Engineer[]
  override: Override
  isOpen: boolean
  onClose: () => void
  onDone?: () => void
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  rotationId,
  engineers,
  override,
  isOpen,
  onClose,
  onDone,
}) => {
  if (!isOpen) return null

  return (
    <ModalDialog title="Edit override" onClose={onClose} width={["100%", 500]}>
      <OverrideForm
        rotationId={rotationId}
        engineers={engineers}
        override={override}
        onCancel={onClose}
        onDone={() => {
          onClose()
          onDone?.()
        }}
      />
    </ModalDialog>
  )
}

export interface CreateSwapButtonProps {
  rotationId: string
  engineers?: Engineer[]
  entries: ScheduleEntry[]
  timezone: string
  onDone?: () => void
}

export const CreateSwapButton: React.FC<CreateSwapButtonProps> = ({
  rotationId,
  engineers,
  entries,
  timezone,
  onDone,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const fetchedEngineers = useEngineers()
  const resolvedEngineers = engineers ?? fetchedEngineers

  return (
    <>
      <Button variant="secondaryBlack" onClick={() => setIsOpen(true)}>
        Swap shifts
      </Button>

      <SwapModal
        rotationId={rotationId}
        engineers={resolvedEngineers}
        entries={entries}
        timezone={timezone}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onDone={onDone}
      />
    </>
  )
}
