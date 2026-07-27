export interface NextPublicEnvVars {
  PUBLIC_GRAVITY_URL: string
}

declare global {
  interface Window {
    __nextPublicEnv__: NextPublicEnvVars
  }
}
