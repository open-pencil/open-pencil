import { useSessionStorage } from '@vueuse/core'
import * as v from 'valibot'

import { StorageUnavailableError } from '../errors'

/**
 * Google sign-in for Drive storage through Google Identity Services' token client: a popup asks
 * the person once, then the access token (one hour) is kept for this browser session. The scope
 * is `drive.file`, so Lawha sees only the files it created, never the rest of the person's Drive.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
const TOKEN_STORAGE_KEY = 'lawha:google-drive-token'
/** Renew a little before Google's expiry, so a long upload does not start on a dying token. */
const EXPIRY_MARGIN_MS = 60_000

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }): TokenClient
  revoke(token: string, done?: () => void): void
}

interface GoogleIdentity {
  accounts: { oauth2: GoogleOAuth2 }
}

const storedTokenSchema = v.object({
  clientId: v.string(),
  token: v.string(),
  expiresAt: v.number()
})

let scriptLoading: Promise<GoogleIdentity> | null = null

function googleIdentity(): GoogleIdentity | null {
  const google: unknown = Reflect.get(window, 'google')
  if (typeof google !== 'object' || google === null || !('accounts' in google)) return null
  return google as GoogleIdentity
}

/** Loads Google Identity Services once; it is only fetched when Drive storage is used. */
function loadIdentityServices(): Promise<GoogleIdentity> {
  const ready = googleIdentity()
  if (ready) return Promise.resolve(ready)
  scriptLoading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT
    script.async = true
    script.onload = () => {
      const loaded = googleIdentity()
      if (loaded) resolve(loaded)
      else reject(new Error('Google sign-in did not load'))
    }
    script.onerror = () => reject(new Error('Could not reach Google sign-in'))
    document.head.append(script)
  })
  scriptLoading.catch(() => {
    scriptLoading = null
  })
  return scriptLoading
}

/** The token for this browser session only; it is gone when the tab closes. */
const storedToken = useSessionStorage<string | null>(TOKEN_STORAGE_KEY, null)

function readStoredToken(clientId: string): string | null {
  const raw = storedToken.value
  if (!raw) return null
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), storedTokenSchema), raw)
  if (!parsed.success || parsed.output.clientId !== clientId) return null
  return parsed.output.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? parsed.output.token : null
}

function storeToken(clientId: string, token: string, expiresInSeconds: number): void {
  storedToken.value = JSON.stringify({
    clientId,
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000
  })
}

export function forgetDriveToken(): void {
  storedToken.value = null
}

/**
 * A Drive access token. With `interactive`, Google's popup asks the person when there is no
 * valid token (call it from a click, or browsers block the popup); without, background work
 * waits until the person reconnects.
 */
export async function driveAccessToken(clientId: string, interactive: boolean): Promise<string> {
  const stored = readStoredToken(clientId)
  if (stored) return stored
  if (!interactive) {
    throw new StorageUnavailableError('Sign in to Google Drive again to keep syncing')
  }
  const google = await loadIdentityServices()
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description ?? response.error ?? 'Google sign-in failed'))
          return
        }
        storeToken(clientId, response.access_token, response.expires_in ?? 3600)
        resolve(response.access_token)
      },
      error_callback: (error) => {
        reject(new Error(error.message ?? error.type ?? 'Google sign-in was closed'))
      }
    })
    client.requestAccessToken({ prompt: '' })
  })
}
