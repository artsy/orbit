import {
  Box,
  Button,
  Flex,
  Input,
  Separator,
  Spacer,
  Text,
  useToasts,
} from "@artsy/palette"
import { Form, Formik } from "formik"
import { useCallback, useEffect, useState } from "react"
import * as Yup from "yup"
import { EditEngineerModal } from "components/engineers/EditEngineerModal"
import { Engineer } from "rotations/types"
import { createEngineer, deleteEngineer } from "utils/api/mutations"

interface AddEngineerValues {
  name: string
  email: string
  slackUserId: string
}

const validationSchema = Yup.object().shape({
  name: Yup.string().required("A name is required"),
  email: Yup.string()
    .email("Must be a valid email address")
    .required("An email is required"),
})

export default function EngineersPage() {
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Engineer | null>(null)
  const { sendToast } = useToasts()

  const loadEngineers = useCallback(async () => {
    setIsLoading(true)

    try {
      const res = await fetch("/api/engineers")
      if (!res.ok) throw new Error("Failed to load engineers")
      const data: Engineer[] = await res.json()
      setEngineers(data)
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error loading engineers",
        description: error?.message,
      })
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadEngineers()
  }, [loadEngineers])

  const handleDelete = async (engineer: Engineer) => {
    if (
      !window.confirm(
        `Delete ${engineer.name}? This permanently removes them and their overrides.`
      )
    )
      return

    setDeletingId(engineer.id)

    try {
      await deleteEngineer(engineer.id)

      setEngineers((current) => current.filter((e) => e.id !== engineer.id))

      sendToast({
        variant: "success",
        message: `${engineer.name} deleted`,
      })
    } catch (error: any) {
      sendToast({
        variant: "error",
        message: "Error deleting engineer",
        description: error?.message,
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Box>
      <Text variant="xl">Engineers</Text>

      <Spacer y={4} />

      <Text variant="lg">Add engineer</Text>

      <Spacer y={2} />

      <Formik<AddEngineerValues>
        initialValues={{ name: "", email: "", slackUserId: "" }}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          try {
            const engineer = await createEngineer({
              name: values.name,
              email: values.email,
              slackUserId: values.slackUserId || null,
            })

            setEngineers((current) => [...current, engineer])
            resetForm()

            sendToast({
              variant: "success",
              message: `${engineer.name} added`,
            })
          } catch (error: any) {
            sendToast({
              variant: "error",
              message: "Error adding engineer",
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
          handleChange,
          handleBlur,
        }) => (
          <Box
            as={Form}
            display="flex"
            flexDirection="column"
            gap={2}
            maxWidth={400}
          >
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
              value={values.slackUserId}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.slackUserId && errors.slackUserId}
            />

            <Button type="submit" loading={isSubmitting} width="fit-content">
              Add engineer
            </Button>
          </Box>
        )}
      </Formik>

      <Spacer y={4} />

      <Separator />

      <Spacer y={4} />

      <Text variant="lg">All engineers</Text>

      <Spacer y={2} />

      {isLoading ? (
        <Text variant="sm" color="mono60">
          Loading…
        </Text>
      ) : engineers.length === 0 ? (
        <Text variant="sm" color="mono60">
          No engineers yet.
        </Text>
      ) : (
        <Box display="flex" flexDirection="column" gap={1}>
          {engineers.map((engineer) => (
            <Flex
              key={engineer.id}
              data-testid={`engineer-row-${engineer.id}`}
              justifyContent="space-between"
              alignItems="center"
              p={2}
              border="1px solid"
              borderColor="mono10"
            >
              <Box>
                <Text variant="sm" fontWeight="bold">
                  {engineer.name}
                </Text>
                <Text variant="xs" color="mono60">
                  {engineer.email}
                </Text>
                {engineer.slackUserId && (
                  <Text variant="xs" color="mono60">
                    Slack ID: {engineer.slackUserId}
                  </Text>
                )}
              </Box>

              <Flex alignItems="center" gap={2}>
                {!engineer.active && (
                  <Text variant="xs" color="mono60">
                    Inactive
                  </Text>
                )}

                <Button
                  size="small"
                  variant="secondaryBlack"
                  onClick={() => setEditing(engineer)}
                >
                  Edit
                </Button>

                <Button
                  size="small"
                  variant="secondaryNeutral"
                  onClick={() => handleDelete(engineer)}
                  loading={deletingId === engineer.id}
                  disabled={deletingId !== null}
                >
                  Delete
                </Button>
              </Flex>
            </Flex>
          ))}
        </Box>
      )}

      {editing && (
        <EditEngineerModal
          engineer={editing}
          isOpen
          onClose={() => setEditing(null)}
          onDone={loadEngineers}
        />
      )}
    </Box>
  )
}
