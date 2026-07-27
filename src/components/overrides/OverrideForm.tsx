import { Box, Button, Flex, Input, Select, useToasts } from "@artsy/palette"
import { Form, Formik } from "formik"
import * as Yup from "yup"
import { Engineer } from "rotations/types"
import { createOverride } from "utils/api/mutations"

export interface OverrideFormProps {
  rotationId: string
  engineers: Engineer[]
  onDone?: () => void
  onCancel?: () => void
}

interface OverrideFormValues {
  replacementEngineerId: string
  startDate: string
  endDate: string
  reason: string
}

const validationSchema = Yup.object().shape({
  replacementEngineerId: Yup.string().required(
    "A replacement engineer is required"
  ),
  startDate: Yup.string().required("A start date is required"),
  endDate: Yup.string()
    .required("An end date is required")
    .test(
      "end-after-start",
      "End date must be on or after the start date",
      function (endDate) {
        const { startDate } = this.parent
        if (!startDate || !endDate) return true
        return endDate >= startDate
      }
    ),
  reason: Yup.string(),
})

export const OverrideForm: React.FC<OverrideFormProps> = ({
  rotationId,
  engineers,
  onDone,
  onCancel,
}) => {
  const { sendToast } = useToasts()

  const engineerOptions = engineers.map((engineer) => ({
    value: engineer.id,
    text: engineer.name,
  }))

  return (
    <Formik<OverrideFormValues>
      initialValues={{
        replacementEngineerId: "",
        startDate: "",
        endDate: "",
        reason: "",
      }}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          await createOverride(rotationId, {
            replacementEngineerId: values.replacementEngineerId,
            startDate: values.startDate,
            endDate: values.endDate,
            reason: values.reason || null,
          })

          sendToast({
            variant: "success",
            message: "Override created",
          })

          onDone?.()
        } catch (error: any) {
          sendToast({
            variant: "error",
            message: "Error creating override",
            description: error?.message,
          })
        } finally {
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
          <Select
            name="replacementEngineerId"
            title="Replacement engineer"
            options={engineerOptions}
            selected={values.replacementEngineerId}
            onSelect={(value) => setFieldValue("replacementEngineerId", value)}
            onBlur={handleBlur}
            error={
              touched.replacementEngineerId && errors.replacementEngineerId
            }
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

          <Input
            name="endDate"
            title="End date"
            type="date"
            value={values.endDate}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.endDate && errors.endDate}
          />

          <Input
            name="reason"
            title="Reason (optional)"
            placeholder="Why is this override needed?"
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
              Create override
            </Button>
          </Flex>
        </Box>
      )}
    </Formik>
  )
}
