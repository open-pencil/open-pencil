import { homeDir, join, runtimeDir } from '@tauri-apps/api/path'
import { readTextFile, exists } from '@tauri-apps/plugin-fs'
import * as v from 'valibot'

import type { DiscoveryInfo } from '@open-pencil/mcp/discovery'

/** The one discovery-file field the app reads; the MCP package validates the whole file. */
const discoveryTokenSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({ authToken: v.optional(v.nullable(v.string())) })
) satisfies v.GenericSchema<string, Partial<Pick<DiscoveryInfo, 'authToken'>>>

/**
 * Reads the auth token from the MCP discovery file via Tauri's FS plugin.
 * The discovery file path is computed locally (not from the /health endpoint)
 * to prevent an unauthenticated /health response from directing file reads
 * to an attacker-controlled path.
 */
export async function readDiscoveryToken(discoveryPath: string): Promise<string | null> {
  try {
    const info = v.safeParse(discoveryTokenSchema, await readTextFile(discoveryPath))
    return info.success ? (info.output.authToken ?? null) : null
  } catch {
    return null
  }
}

/** Check whether the discovery file exists on disk. */
export async function discoveryFileExists(discoveryPath: string): Promise<boolean> {
  try {
    return await exists(discoveryPath)
  } catch {
    return false
  }
}

/** Trimmed `$XDG_RUNTIME_DIR`, or '' when it is unset or blank. */
async function xdgRuntimeDir(): Promise<string> {
  try {
    return (await runtimeDir()).trim()
  } catch {
    return ''
  }
}

/**
 * Computes the expected MCP discovery file path using the same platform
 * logic as the server's getDiscoveryPath(), but via Tauri APIs since we
 * run in the browser. This avoids trusting the unauthenticated /health
 * endpoint's discoveryPath field.
 */
export async function computeExpectedDiscoveryPath(): Promise<string> {
  const home = await homeDir()
  if (!home) throw new Error('homeDir() returned an empty string')

  const isMac = navigator.platform.includes('Mac')
  const isWindows = navigator.platform.includes('Win')
  // Must match getPlatformDir() in packages/mcp/src/transport/paths.ts.
  // On Windows, LOCALAPPDATA usually equals <home>\AppData\Local, so this
  // fallback matches the server in the common case. A custom LOCALAPPDATA still
  // reaches resolveDiscoveryPath()'s /health fallback.
  if (isMac) {
    return join(home, 'Library', 'Application Support', 'OpenPencil', 'mcp.json')
  }
  if (isWindows) {
    return join(home, 'AppData', 'Local', 'OpenPencil', 'mcp.json')
  }
  // Linux and other Unix: $XDG_RUNTIME_DIR/openpencil/mcp.json, else ~/.openpencil/mcp.json.
  // That directory sits outside home, which the /health fallback refuses.
  const runtime = await xdgRuntimeDir()
  if (runtime) return join(runtime, 'openpencil', 'mcp.json')
  return join(home, '.openpencil', 'mcp.json')
}

/**
 * Resolves the discovery path to use for reading the auth token.
 *
 * Prefers the locally-computed path from `computeExpectedDiscoveryPath()` for
 * security. When the server-reported `healthDiscoveryPath` (from the
 * unauthenticated `/health` endpoint) differs, logs a warning and falls back
 * to the server-reported path as a compatibility measure.
 *
 * Security tradeoff: the `/health` endpoint is unauthenticated, so a
 * compromised server could redirect us to a malicious path. This is mitigated
 * by the fact that the server is on localhost and was spawned by us. The
 * fallback exists because local computation can still be wrong (for example a
 * custom LOCALAPPDATA on Windows). A path outside the home directory, such as
 * Linux `$XDG_RUNTIME_DIR`, is never taken from `/health`.
 */
export async function resolveDiscoveryPath(healthDiscoveryPath?: string): Promise<string> {
  const expected = await computeExpectedDiscoveryPath()
  if (healthDiscoveryPath && healthDiscoveryPath !== expected) {
    const localExists = await discoveryFileExists(expected)
    if (!localExists) {
      // Validate the server-reported path before accepting it. The /health
      // endpoint is unauthenticated, so we only accept paths within the
      // user's home directory ending in mcp.json.
      const home = await homeDir()
      const sep = home.includes('\\') ? '\\' : '/'
      const hasTraversal = healthDiscoveryPath.split(/[\\/]/).some((segment) => segment === '..')
      const isSafe =
        healthDiscoveryPath.endsWith('mcp.json') &&
        !hasTraversal &&
        healthDiscoveryPath.startsWith(home + sep)
      if (isSafe) {
        console.warn(
          `[MCP] Server discovery path "${healthDiscoveryPath}" differs from expected "${expected}" ` +
            'and local path does not exist. Using server-reported path (server is on localhost).'
        )
        return healthDiscoveryPath
      }
    }
  }
  return expected
}
