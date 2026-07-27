import { NextPublicEnvVars } from "typings/NextPublicEnvVars"

export function getENV<T extends string>(key: keyof NextPublicEnvVars) {
  let envVar
  if (typeof window === "undefined") {
    envVar = process.env[key]
  } else {
    envVar = window.__nextPublicEnv__?.[key]
  }

  return envVar as T
}

export const getNextPublicEnvVarsFromServer = (): Record<string, any> => {
  return Object.entries(process.env).reduce((acc, [key, value]) => {
    if (!key.startsWith("PUBLIC_")) {
      return acc
    }
    return { ...acc, [key]: value }
  }, {})
}
