import "@testing-library/jest-dom"

jest.mock("system/getENV", () => ({
  getENV: jest.fn().mockReturnValue(""),
  getNextPublicEnvVarsFromServer: jest.fn().mockReturnValue({}),
}))

jest.mock("next/router", () => require("next-router-mock"))
