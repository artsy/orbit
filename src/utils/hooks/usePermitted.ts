import { useSession } from "next-auth/react"
import { Action, Domain, UserWithAccessToken, isPermitted } from "system"

export const usePermitted = (domain: Domain, action?: Action): boolean => {
  const session = useSession()
  const user = session.data?.user as UserWithAccessToken | undefined
  return isPermitted(user, domain, action)
}
