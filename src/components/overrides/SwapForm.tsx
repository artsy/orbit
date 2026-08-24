import { Box, Button, Flex, Input, Select, useToasts } from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import { format, parseISO } from "date-fns"
import { Form, Formik, useFormikContext } from "formik"
import { useMemo } from "react"
import * as Yup from "yup"
import { Engineer, ScheduleEntry } from "rotations/types"
import { upcomingShiftsFor as upcomingEffectiveShiftsFor } from "rotations/logic"
import { createSwap, deleteOverride } from "utils/api/mutations"

export interface SwapFormProps {
  rotationId: string
  engineers: Engineer[]
  entries: ScheduleEntry[]
  timezone: string
  initialValues?: Partial<SwapFormValues>
  /**
   * When editing an existing swap, the ids of its overrides — they are deleted
   * and replaced with a fresh swap on submit.
   */
  replaceOverrideIds?: string[]
  onDone?: () => void
  onCancel?: () => void
}

export interface SwapFormValues {
  engineerAId: string
  dateA: string
  engineerBId: string
  dateB: string
  reason: string
}

// Effective (post-override), not base — an engineer's shift can be one a
// previous swap moved onto their schedule, not just their round-robin slot.
// Capped to the nearest two so the dropdown stays short.
const upcomingShiftsFor = (engineerId: string, entries: ScheduleEntry[]) =>
  upcomingEffectiveShiftsFor(entries, engineerId, new Date()).slice(0, 2)

const shiftLabel = (entry: ScheduleEntry, timezone: string) => {
  const start = new TZDate(parseISO(entry.periodStart).getTime(), timezone)
  const endInclusive = new TZDate(
    parseISO(entry.periodEnd).getTime() - 1,
    timezone
  )
  return `${format(start, "MMM d")} – ${format(endInclusive, "MMM d")}`
}

// Confirms `engineerId` is *effectively* on call for the shift starting at
// `periodStart` — i.e. matches `entries` as of right now, not as of whenever
// the form was opened. This is what stops a swap built from stale data (most
// notably editing a swap that a later one has since chained off of) from
// reaching the API instead of surfacing a field error.
const holdsShift = (
  entries: ScheduleEntry[],
  engineerId: string | undefined,
  periodStart: string | undefined
) => {
  if (!engineerId || !periodStart) return true
  return entries.some(
    (e) => e.periodStart === periodStart && e.effectiveEngineerId === engineerId
  )
}

// A function of `entries` rather than a module-level constant: the
// "still holds this shift" checks need the current schedule, and this
// Formik version doesn't thread a validation context through to Yup.
const buildValidationSchema = (entries: ScheduleEntry[]) =>
  Yup.object().shape({
    engineerAId: Yup.string().required("Engineer A is required"),
    dateA: Yup.string()
      .required("A date within engineer A's shift is required")
      .test(
        "holds-shift-a",
        "Engineer A is no longer on call for that shift — pick another",
        function (dateA) {
          return holdsShift(entries, this.parent.engineerAId, dateA)
        }
      ),
    engineerBId: Yup.string()
      .required("Engineer B is required")
      .test(
        "distinct-engineers",
        "Engineers must be different",
        function (engineerBId) {
          const { engineerAId } = this.parent
          if (!engineerAId || !engineerBId) return true
          return engineerAId !== engineerBId
        }
      ),
    dateB: Yup.string()
      .required("A date within engineer B's shift is required")
      .test(
        "holds-shift-b",
        "Engineer B is no longer on call for that shift — pick another",
        function (dateB) {
          return holdsShift(entries, this.parent.engineerBId, dateB)
        }
      ),
    reason: Yup.string(),
  })

interface SwapFormFieldsProps {
  engineerOptions: { value: string; text: string }[]
  entries: ScheduleEntry[]
  timezone: string
  submitLabel: string
  onCancel?: () => void
}

const SwapFormFields: React.FC<SwapFormFieldsProps> = ({
  engineerOptions,
  entries,
  timezone,
  submitLabel,
  onCancel,
}) => {
  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleBlur,
    handleChange,
    setFieldValue,
  } = useFormikContext<SwapFormValues>()

  const optionsA = upcomingShiftsFor(values.engineerAId, entries).map((e) => ({
    value: e.periodStart,
    text: shiftLabel(e, timezone),
  }))
  const optionsB = upcomingShiftsFor(values.engineerBId, entries).map((e) => ({
    value: e.periodStart,
    text: shiftLabel(e, timezone),
  }))

  // Selecting an engineer also picks their nearest upcoming shift right away, so
  // the shift dropdown is populated on the first selection (no toggling needed).
  const selectEngineer = (field: "engineerAId" | "engineerBId", value: string) => {
    const dateField = field === "engineerAId" ? "dateA" : "dateB"
    const [nearest] = upcomingShiftsFor(value, entries)
    setFieldValue(field, value)
    setFieldValue(dateField, nearest?.periodStart ?? "")
  }

  const engineerSelectOptions = [
    { value: "", text: "Choose an engineer" },
    ...engineerOptions,
  ]

  const shiftSelectOptions = (
    opts: { value: string; text: string }[],
    engineerId: string
  ) =>
    opts.length
      ? opts
      : [
          {
            value: "",
            text: engineerId ? "No upcoming shifts" : "Choose an engineer first",
          },
        ]

  return (
    <Box as={Form} display="flex" flexDirection="column" gap={2}>
      <Select
        name="engineerAId"
        title="Engineer A"
        options={engineerSelectOptions}
        selected={values.engineerAId}
        onSelect={(value) => selectEngineer("engineerAId", value)}
        onBlur={handleBlur}
        error={touched.engineerAId && errors.engineerAId}
      />

      <Select
        key={`dateA-${values.engineerAId}`}
        name="dateA"
        title="Engineer A's shift"
        options={shiftSelectOptions(optionsA, values.engineerAId)}
        selected={values.dateA}
        onSelect={(value) => setFieldValue("dateA", value)}
        onBlur={handleBlur}
        error={touched.dateA && errors.dateA}
      />

      <Select
        name="engineerBId"
        title="Engineer B"
        options={engineerSelectOptions}
        selected={values.engineerBId}
        onSelect={(value) => selectEngineer("engineerBId", value)}
        onBlur={handleBlur}
        error={touched.engineerBId && errors.engineerBId}
      />

      <Select
        key={`dateB-${values.engineerBId}`}
        name="dateB"
        title="Engineer B's shift"
        options={shiftSelectOptions(optionsB, values.engineerBId)}
        selected={values.dateB}
        onSelect={(value) => setFieldValue("dateB", value)}
        onBlur={handleBlur}
        error={touched.dateB && errors.dateB}
      />

      <Input
        name="reason"
        title="Reason (optional)"
        placeholder="Why are these shifts being swapped?"
        value={values.reason}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.reason && errors.reason}
      />

      <Flex justifyContent="flex-end" gap={1} mt={1}>
        {onCancel && (
          <Button
            type="button"
            variant="secondaryBlack"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}

        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </Flex>
    </Box>
  )
}

export const SwapForm: React.FC<SwapFormProps> = ({
  rotationId,
  engineers,
  entries,
  timezone,
  initialValues,
  replaceOverrideIds,
  onDone,
  onCancel,
}) => {
  const { sendToast } = useToasts()
  const isEditing = !!replaceOverrideIds?.length

  const engineerOptions = engineers.map((engineer) => ({
    value: engineer.id,
    text: engineer.name,
  }))

  const validationSchema = useMemo(
    () => buildValidationSchema(entries),
    [entries]
  )

  return (
    <Formik<SwapFormValues>
      enableReinitialize
      initialValues={{
        engineerAId: "",
        dateA: "",
        engineerBId: "",
        dateB: "",
        reason: "",
        ...initialValues,
      }}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          // Editing a swap = replace its overrides with a fresh swap.
          if (replaceOverrideIds?.length) {
            await Promise.all(replaceOverrideIds.map((id) => deleteOverride(id)))
          }

          await createSwap(rotationId, {
            engineerAId: values.engineerAId,
            engineerBId: values.engineerBId,
            dateA: values.dateA,
            dateB: values.dateB,
            reason: values.reason || null,
          })

          sendToast({
            variant: "success",
            message: isEditing ? "Swap updated" : "Shifts swapped",
          })

          onDone?.()
        } catch (error: any) {
          sendToast({
            variant: "error",
            message: isEditing ? "Error updating swap" : "Error swapping shifts",
            description: error?.message,
          })
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <SwapFormFields
        engineerOptions={engineerOptions}
        entries={entries}
        timezone={timezone}
        submitLabel={isEditing ? "Save changes" : "Swap shifts"}
        onCancel={onCancel}
      />
    </Formik>
  )
}
