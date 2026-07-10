/**
 * App configuration read from Expo's public env (issue #11). `EXPO_PUBLIC_*`
 * variables are inlined at build time and safe to read on the client. When no API
 * URL is configured — the default in local dev and the test gate — the app runs
 * on illustrative demo data instead of calling the backend.
 */
function readApiBaseUrl(): string | null {
  const raw: unknown = process.env.EXPO_PUBLIC_API_URL
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : null
}

/** The backend base URL (no trailing slash), or `null` to run on demo data. */
export const apiBaseUrl: string | null = readApiBaseUrl()
