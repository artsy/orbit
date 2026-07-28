import {
  Box,
  Button,
  Flex,
  Input,
  ModalDialog,
  Select,
  useToasts,
} from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import { format, parseISO } from "date-fns"
import { Form, Formik } from "formik"
import * as Yup from "yup"
import { Rotation } from "rotations/types"
import { ALLOWED_TIMEZONES, TIMEZONE_LABELS } from "rotations/timezones"
import { updateRotation } from "utils/api/mutations"

interface EditRotationValues {
  name: string
  description: string
  cadence: string // "7" (weekly) or "14" (biweekly)
  startDate: string // YYYY-MM-DD
  startHour: string // "0".."23"
  timezone: string
}

const cadenceOptions = [
  { value: "7", text: "Weekly" },
  { value: "14", text: "Biweekly" },
]

const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  text: `${String(hour).padStart(2, "0")}:00`,
}))

const timezoneOptions = ALLOWED_TIMEZONES.map((tz) => ({
  value: tz,
  text: TIMEZONE_LABELS[tz],
}))

const validationSchema = Yup.object().shape({
  name: Yup.string().required("A name is required"),
  cadence: Yup.string().required(),
  startDate: Yup.string().required("A start date is required"),
  startHour: Yup.string().required("A start hour is required"),
  timezone: Yup.string().required("A timezone is required"),
})

export interface EditRotationModalProps {
  rotation: Rotation
  isOpen: boolean
  onClose: () => void
  onDone?: () => void
}

export const EditRotationModal: React.FC<EditRotationModalProps> = ({
  rotation,
  isOpen,
  onClose,
  onDone,
}) => {
  const { sendToast } = useToasts()

  if (!isOpen) return null

  // Decompose the stored anchor instant into a local date + hour in the
  // rotation's timezone (the inverse of what the submit handler recombines).
  const anchor = new TZDate(
    parseISO(rotation.anchorDate).getTime(),
    rotation.timezone
  )

  return (
    <ModalDialog title="Edit rotation" onClose={onClose} width={["100%", 500]}>
      <Formik<EditRotationValues>
        initialValues={{
          name: rotation.name,
          description: rotation.description ?? "",
          cadence: String(rotation.cadenceDays),
          startDate: format(anchor, "yyyy-MM-dd"),
          startHour: String(anchor.getHours()),
          timezone: rotation.timezone,
        }}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            const [year, month, day] = values.startDate.split("-").map(Number)
            const anchorDate = TZDate.tz(
              values.timezone,
              year,
              month - 1,
              day,
              Number(values.startHour),
              0,
              0,
              0
            ).toISOString()

            await updateRotation(rotation.id, {
              name: values.name,
              description: values.description || null,
              cadenceDays: Number(values.cadence),
              anchorDate,
              timezone: values.timezone,
            })

            sendToast({ variant: "success", message: "Rotation updated" })
            onClose()
            onDone?.()
          } catch (error: any) {
            sendToast({
              variant: "error",
              message: "Error updating rotation",
              description: error?.message,
            })
            setSubmitting(false)
          }
        }}
      >
        {({
          values,
          errors,
          touched,
          isSubmitting,
          handleBlur,
          handleChange,
          setFieldValue,
        }) => (
          <Box as={Form} display="flex" flexDirection="column" gap={2}>
            <Input
              name="name"
              title="Name"
              value={values.name}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.name && errors.name}
            />

            <Input
              name="description"
              title="Description (optional)"
              placeholder="What is this rotation for?"
              value={values.description}
              onChange={handleChange}
              onBlur={handleBlur}
            />

            <Select
              name="cadence"
              title="Cadence"
              options={cadenceOptions}
              selected={values.cadence}
              onSelect={(value) => setFieldValue("cadence", value)}
            />

            <Input
              name="startDate"
              title="Start date"
              type="date"
              value={values.startDate}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.startDate && errors.startDate}
            />

            <Select
              name="startHour"
              title="Start hour (handoff time)"
              options={hourOptions}
              selected={values.startHour}
              onSelect={(value) => setFieldValue("startHour", value)}
            />

            <Select
              name="timezone"
              title="Timezone"
              options={timezoneOptions}
              selected={values.timezone}
              onSelect={(value) => setFieldValue("timezone", value)}
            />

            <Flex justifyContent="flex-end" gap={1} mt={1}>
              <Button
                type="button"
                variant="secondaryBlack"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Save changes
              </Button>
            </Flex>
          </Box>
        )}
      </Formik>
    </ModalDialog>
  )
}
