import { Box, Button, Flex, Input, Select, Spacer, Text, useToasts } from "@artsy/palette"
import { TZDate } from "@date-fns/tz"
import { Form, Formik } from "formik"
import { useRouter } from "next/router"
import * as Yup from "yup"
import { createRotation } from "utils/api/mutations"
import { ALLOWED_TIMEZONES, TIMEZONE_LABELS, DEFAULT_TIMEZONE } from "rotations/timezones"

interface NewRotationValues {
  name: string
  cadence: string // "7" (weekly) or "14" (biweekly)
  startDate: string // YYYY-MM-DD
  startHour: string // "0".."23"
  timezone: string // IANA zone, e.g. "America/New_York"
  description: string
}

const cadenceOptions = [
  { value: "7", text: "Weekly" },
  { value: "14", text: "Biweekly" },
]

// "0:00".."23:00" hour-of-day options.
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

export default function NewRotationPage() {
  const router = useRouter()
  const { sendToast } = useToasts()

  return (
    <Box maxWidth={480}>
      <Text variant="xl">New rotation</Text>

      <Spacer y={4} />

      <Formik<NewRotationValues>
        initialValues={{
          name: "",
          cadence: "7",
          startDate: "",
          startHour: "10",
          timezone: DEFAULT_TIMEZONE,
          description: "",
        }}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            // Combine the chosen date + hour into an anchor instant, interpreted
            // in the rotation's timezone (the weekly/biweekly handoff time).
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

            const rotation = await createRotation({
              name: values.name,
              cadenceDays: Number(values.cadence),
              anchorDate,
              timezone: values.timezone,
              description: values.description || null,
            })

            sendToast({ variant: "success", message: `${rotation.name} created` })
            router.push(`/rotations/${rotation.id}`)
          } catch (error: any) {
            sendToast({
              variant: "error",
              message: "Error creating rotation",
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
              placeholder="e.g. Platform on-call"
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

            <Flex justifyContent="flex-end" mt={1}>
              <Button type="submit" loading={isSubmitting}>
                Create rotation
              </Button>
            </Flex>
          </Box>
        )}
      </Formik>
    </Box>
  )
}
