import Document, {
  DocumentContext,
  Head,
  Html,
  Main,
  NextScript,
} from "next/document"
import { ServerStyleSheet } from "styled-components"
import { getNextPublicEnvVarsFromServer } from "system/getENV"
import { NextPublicEnvVars } from "typings/NextPublicEnvVars"

interface AppDocumentProps {
  nextPublicEnv: NextPublicEnvVars
}

export default class AppDocument extends Document<AppDocumentProps> {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta name="robots" content="noindex, nofollow" />
          <link
            href="https://webfonts.artsy.net/all-webfonts.css"
            rel="stylesheet"
            type="text/css"
          />
        </Head>

        <body>
          <Main />
          <NextScript />

          {/*
            Work-around to continue supporting runtime env vars on the client,
            which do not otherwise reach client components in modern Next.js.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.__nextPublicEnv__ = ${JSON.stringify(
                  this.props.nextPublicEnv
                )}
              `,
            }}
          />
        </body>
      </Html>
    )
  }

  static async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet()
    const originalRenderPage = ctx.renderPage

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) =>
            sheet.collectStyles(<App {...props} />),
        })

      const initialProps = await Document.getInitialProps(ctx)

      let nextPublicEnv = {}
      if (typeof window === "undefined") {
        nextPublicEnv = getNextPublicEnvVarsFromServer()
      }

      return {
        ...initialProps,
        nextPublicEnv,
        styles: [initialProps.styles, sheet.getStyleElement()],
      }
    } finally {
      // @ts-ignore
      sheet.seal()
    }
  }
}
