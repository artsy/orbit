import {
  Box,
  Button,
  Checkbox,
  Flex,
  Input,
  ModalDialog,
  Text,
  useToasts,
} from "@artsy/palette"
import { Form, Formik } from "formik"
import * as Yup from "yup"
import { Engineer, EngineerPattern } from "rotations/types"
import { colorForEngineer } from "rotations/colors"
import { ColorPicker } from "./ColorPicker"
import { PatternPicker } from "./PatternPicker"
import { updateEngineer } from "utils/api/mutations"

interface EditEngineerValues {
  name: string
  email: string
  slackUserId: string
  active: boolean
  color: string | null
  pattern: EngineerPattern | null
}

const validationSchema = Yup.object().shape({
  name: Yup.string().required("A name is required"),
  email: Yup.string()
    .email("Must be a valid email address")
    .required("An email is required"),
})

export interface EditEngineerModalProps {
  engineer: Engineer
  isOpen: boolean
  onClose: () => void
  onDone?: () => void
}

export const EditEngineerModal: React.FC<EditEngineerModalProps> = ({
  engineer,
  isOpen,
  onClose,
  onDone,
}) => {
  const { sendToast } = useToasts()

  if (!isOpen) return null

  return (
    <ModalDialog title="Edit engineer" onClose={onClose} width={["100%", 500]}>
      <Formik<EditEngineerValues>
        initialValues={{
          name: engineer.name,
          email: engineer.email,
          slackUserId: engineer.slackUserId ?? "",
          active: engineer.active,
          color: engineer.color,
          pattern: engineer.pattern,
        }}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            await updateEngineer(engineer.id, {
              name: values.name,
              email: values.email,
              slackUserId: values.slackUserId || null,
              active: values.active,
              color: values.color,
              pattern: values.pattern,
            })

            sendToast({ variant: "success", message: "Engineer updated" })
            onClose()
            onDone?.()
          } catch (error: any) {
            sendToast({
              variant: "error",
              message: "Error updating engineer",
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
              name="email"
              title="Email"
              type="email"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.email && errors.email}
            />

            <Input
              name="slackUserId"
              title="Slack user ID"
              placeholder="e.g. U01427GSPK9 (for bot @mentions)"
              description="In Slack, open the person's profile, click the ⋮ (more) button, then Copy member ID."
              value={values.slackUserId}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.slackUserId && errors.slackUserId}
            />

            <Box>
              <Checkbox
                selected={values.active}
                onSelect={(selected) => setFieldValue("active", selected)}
              >
                Active
              </Checkbox>
              <Text variant="xs" color="mono60">
                Inactive engineers are skipped in rotations.
              </Text>
            </Box>

            <ColorPicker
              value={values.color}
              onChange={(color) => setFieldValue("color", color)}
              engineerId={engineer.id}
            />

            <PatternPicker
              value={values.pattern}
              onChange={(pattern) => setFieldValue("pattern", pattern)}
              previewColor={colorForEngineer(
                { ...engineer, color: values.color },
                engineer.id
              )}
              previewName={values.name || engineer.name}
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
