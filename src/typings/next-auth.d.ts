import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      accessToken?: string
      roles?: string[]
    }
  }

  interface User {
    roles?: string[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string
    roles?: string[]
  }
}
