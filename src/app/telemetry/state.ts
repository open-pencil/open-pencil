import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

import { IS_TAURI } from '@/constants'

/** Device state behind sharing, kept apart from preferences because people never edit it. */
export interface SharingState {
  /** Random ID made when the person agreed to usage stats, removed when they stop. */
  installId: string | null
  /** UTC day of the last delivered ping, so an install pings once a day. */
  lastPingDay: string | null
}

const sharingStateSchema = v.object({
  installId: v.fallback(v.nullable(v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/))), null),
  lastPingDay: v.fallback(v.nullable(v.pipe(v.string(), v.isoDate())), null)
})

export const sharingState = useLocalStorage<SharingState>(
  'open-pencil:sharing:v1',
  { installId: null, lastPingDay: null },
  {
    mergeDefaults: (stored) =>
      v.parse(
        v.fallback(sharingStateSchema, () => v.parse(sharingStateSchema, {})),
        stored
      )
  }
)

/** How long the desktop app waits to learn whether its environment turns sharing off. */
const ENVIRONMENT_CHECK_TIMEOUT_MS = 2_000

let disabledByEnvironment: Promise<boolean> | null = null

async function readDesktopEnvironment(): Promise<boolean> {
  const { invoke } = await import('@tauri-apps/api/core')
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(true), ENVIRONMENT_CHECK_TIMEOUT_MS)
  })
  return Promise.race([invoke<boolean>('sharing_disabled_by_env'), timeout])
}

/**
 * `OPENPENCIL_TELEMETRY=0` or `DO_NOT_TRACK` in the desktop app's environment turns sharing off.
 * A check that fails or does not answer counts as off, so nothing is sent against the person's wish.
 */
export function sharingDisabledByEnvironment(): Promise<boolean> {
  disabledByEnvironment ??= IS_TAURI
    ? readDesktopEnvironment().catch(() => true)
    : Promise.resolve(false)
  return disabledByEnvironment
}
