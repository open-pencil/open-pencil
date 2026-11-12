import * as v from 'valibot'

import { isTauri } from './env'

/**
 * Features a desktop package can switch off for its installs. The shell reads them
 * from the launcher environment and defines them on `window` before any page script
 * runs (`desktop/src/capabilities.rs`), so modules can read them at import time.
 */
export type DesktopCapabilities = v.InferOutput<typeof desktopCapabilitiesSchema>

const desktopCapabilitiesSchema = v.object({
  /** The built-in updater; off when a store delivers updates. */
  selfUpdate: v.boolean(),
  /** Spawning host programs: ACP agents, npm installs, the MCP server, the Pi harness. */
  hostProcesses: v.boolean()
})

const BROWSER: DesktopCapabilities = { selfUpdate: false, hostProcesses: false }
/** What a desktop shell that defines nothing gets: the shell's own defaults. */
const DESKTOP_DEFAULTS: DesktopCapabilities = { selfUpdate: true, hostProcesses: true }

export function readDesktopCapabilities(desktop: boolean, injected: unknown): DesktopCapabilities {
  if (!desktop) return BROWSER
  if (injected === undefined) return DESKTOP_DEFAULTS
  const parsed = v.safeParse(desktopCapabilitiesSchema, injected)
  if (parsed.success) return parsed.output
  // The shell enforces both itself, so a malformed value only risks showing a feature
  // that then fails; hiding everything would lock a normal install out of it.
  console.error('[Desktop] Ignoring malformed capabilities:', parsed.issues)
  return DESKTOP_DEFAULTS
}

export function desktopCapabilities(): DesktopCapabilities {
  const injected =
    'window' in globalThis ? globalThis.window.__OPENPENCIL_DESKTOP_CAPABILITIES__ : undefined
  return readDesktopCapabilities(isTauri(), injected)
}

export function canSelfUpdate(): boolean {
  return desktopCapabilities().selfUpdate
}

export function canRunHostProcesses(): boolean {
  return desktopCapabilities().hostProcesses
}
