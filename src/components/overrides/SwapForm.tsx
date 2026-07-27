import { Box, Button, Flex, Input, Select, useToasts } from "@artsy/palette"
import { Form, Formik } from "formik"
import * as Yup from "yup"
import { Engineer } from "rotations/types"
import { createSwap } from "utils/api/mutations"

export interface SwapFormProps {
  rotationId: string
  engineers: Engineer[]
  onDone?: () => void
  onCancel?: () => void
}

interface SwapFormValues {
  engineerAId: string
  dateA: string
  engineerBId: string
  dateB: string
  reason: string
}

const validationSchema = Yup.object().shape({
  engineerAId: Yup.string().required("Engineer A is required"),
  dateA: Yup.string().required("A date within engineer A's shift is required"),
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
  dateB: Yup.string().required("A date within engineer B's shift is required"),
  reason: Yup.string(),
})

export const SwapForm: React.FC<SwapFormProps> = ({
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
    <Formik<SwapFormValues>
      initialValues={{
        engineerAId: "",
        dateA: "",
        engineerBId: "",
        dateB: "",
        reason: "",
      }}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          await createSwap(rotationId, {
            engineerAId: values.engineerAId,
            engineerBId: values.engineerBId,
            dateA: values.dateA,
            dateB: values.dateB,
            reason: values.reason || null,
          })

          sendToast({
            variant: "success",
            message: "Shifts swapped",
          })

          onDone?.()
        } catch (error: any) {
          sendToast({
            variant: "error",
            message: "Error swapping shifts",
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
            name="engineerAId"
            title="Engineer A"
            options={engineerOptions}
            selected={values.engineerAId}
            onSelect={(value) => setFieldValue("engineerAId", value)}
            onBlur={handleBlur}
            error={touched.engineerAId && errors.engineerAId}
          />

          <Input
            name="dateA"
            title="Date within engineer A's shift"
            type="date"
            value={values.dateA}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.dateA && errors.dateA}
          />

          <Select
            name="engineerBId"
            title="Engineer B"
            options={engineerOptions}
            selected={values.engineerBId}
            onSelect={(value) => setFieldValue("engineerBId", value)}
            onBlur={handleBlur}
            error={touched.engineerBId && errors.engineerBId}
          />

          <Input
            name="dateB"
            title="Date within engineer B's shift"
            type="date"
            value={values.dateB}
            onChange={handleChange}
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
              Swap shifts
            </Button>
          </Flex>
        </Box>
      )}
    </Formik>
  )
}
