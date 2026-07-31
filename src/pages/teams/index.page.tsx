import { Box, Button, Flex, Input, Spinner, Text, useToasts } from "@artsy/palette"
import { Form, Formik } from "formik"
import Link from "next/link"
import * as Yup from "yup"
import { createTeam } from "utils/api/mutations"
import { useTeams } from "utils/hooks/useApi"

interface NewTeamValues {
  name: string
}

const validationSchema = Yup.object().shape({
  name: Yup.string().required("A name is required"),
})

export default function TeamsPage() {
  const { data: teams, error, isLoading, mutate } = useTeams()
  const { sendToast } = useToasts()

  return (
    <Box>
      <Text variant="xl">Teams</Text>
      <Text variant="sm" color="mono60" mt={0.5}>
        Group engineers so you can add them all to a rotation at once.
      </Text>

      <Box mt={2} maxWidth={400}>
        <Formik<NewTeamValues>
          initialValues={{ name: "" }}
          validationSchema={validationSchema}
          onSubmit={async (values, { setSubmitting, resetForm }) => {
            try {
              const team = await createTeam({ name: values.name })
              await mutate()
              resetForm()
              sendToast({ variant: "success", message: `${team.name} created` })
            } catch (error: any) {
              sendToast({
                variant: "error",
                message: "Error creating team",
                description: error?.message,
              })
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {({ values, errors, touched, isSubmitting, handleChange, handleBlur }) => (
            <Flex as={Form} gap={1} alignItems="flex-end">
              <Box flex={1}>
                <Input
                  name="name"
                  title="New team"
                  placeholder="e.g. Frontend"
                  value={values.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.name && errors.name}
                />
              </Box>
              <Button type="submit" size="small" loading={isSubmitting}>
                Create
              </Button>
            </Flex>
          )}
        </Formik>
      </Box>

      <Box mt={4}>
        {isLoading && (
          <Flex justifyContent="center" py={4}>
            <Spinner />
          </Flex>
        )}

        {error && (
          <Text variant="sm" color="red100" mt={1}>
            Couldn&apos;t load teams. Please try again later.
          </Text>
        )}

        {!isLoading && !error && (!teams || teams.length === 0) && (
          <Text variant="sm" color="mono60">
            No teams yet. Create one above.
          </Text>
        )}

        {!isLoading && !error && teams && teams.length > 0 && (
          <Box display="flex" flexDirection="column" gap={1}>
            {teams.map((team) => (
              <Box
                key={team.id}
                p={2}
                border="1px solid"
                borderColor="mono10"
                borderRadius={4}
              >
                <Link href={`/teams/${team.id}`} style={{ color: "inherit" }}>
                  <Text variant="sm-display">{team.name}</Text>
                </Link>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
