/**
 * Origins allowed to call the local server from a view.
 *
 * The desktop app's webview always calls the server from its own origin, so a
 * manually started server must allow it without extra configuration. Browsers
 * set `Origin` themselves, and only the Tauri webview serves these origins, so
 * allowing them does not expose the server to arbitrary websites. Requests still
 * need the bearer token whenever authentication is enabled.
 */
export const DESKTOP_APP_ORIGINS = [
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost'
] as const

/** Parse a comma-separated override. Returns null when nothing usable is set. */
export function parseCORSOrigins(raw: string | undefined | null): string[] | null {
  if (raw == null) return null
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
  return origins.length > 0 ? origins : null
}

/** Explicit configuration wins; otherwise the desktop app origin is allowed. */
export function resolveCORSOrigins(raw: string | undefined): readonly string[] {
  return parseCORSOrigins(raw) ?? DESKTOP_APP_ORIGINS
}
