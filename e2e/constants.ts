// Shared between the Playwright config's dev server and global-setup so the
// injected session cookie is signed with the same secret the app verifies.
export const NEXTAUTH_SECRET = "e2e-test-secret-not-for-production"
export const BASE_URL = "http://localhost:3000"
