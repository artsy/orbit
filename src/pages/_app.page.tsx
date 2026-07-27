import "../styles/globals.css"
import App from "next/app"
import type { AppContext, AppProps } from "next/app"
import { getSession } from "next-auth/react"
import { Layout } from "components/Layout"
import { Boot } from "system/Boot"
import type { UserWithAccessToken } from "system"

export default function OrbitApp({ Component, pageProps }: AppProps) {
  const user = pageProps.session?.user as UserWithAccessToken | undefined

  return (
    <Boot session={pageProps.session ?? null}>
      <Layout user={user} tokenValid={pageProps.tokenValid ?? false}>
        <Component {...pageProps} />
      </Layout>
    </Boot>
  )
}

OrbitApp.getInitialProps = async (appContext: AppContext) => {
  const session = await getSession(appContext.ctx)
  const appProps = await App.getInitialProps(appContext)

  appProps.pageProps.session = session
  // We trust the next-auth session as the source of truth for this internal
  // tool; a valid session means a valid Gravity access token at sign-in time.
  appProps.pageProps.tokenValid = !!session?.user

  return appProps
}
