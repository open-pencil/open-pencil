import { randomBytes } from 'node:crypto'
import { access, constants, lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises'

import { getDiscoveryPath, getSocketPath, platformHasUnixSockets } from '#mcp/transport/paths'

/**
 * Metadata written to the discovery file so clients can auto-locate
 * the running MCP server without knowing the socket path or TCP port.
 *
 * WARNING: The discovery file contains a plaintext auth token. Do not sync
 * this file to cloud storage or include it in backups without encryption.
 * Any process running as the same user can read this file.
 */
export interface DiscoveryInfo {
  pid: number
  /** Unix domain socket path, or null on platforms that don't support them (Windows). */
  socketPath: string | null
  httpPort: number
  authRequired: boolean
  authToken: string | null
  version: string
  startedAt: string
}

/**
 * Writes the discovery JSON file at the platform-appropriate location.
 * Overwrites any existing file (from a previous server instance).
 *
 * The write is atomic: a sibling temp file is written first with `0o600`
 * permissions, then renamed over the final path. This avoids leaving
 * a half-written file visible to readers if the process is killed
 * mid-write, and prevents concurrent writers from corrupting the file
 * by interleaving their writes.
 *
 * WARNING: The auth token is written in plaintext. Do not sync the discovery
 * file to cloud storage or include it in backups without encryption.
 */
export async function writeDiscoveryFile(info: DiscoveryInfo): Promise<void> {
  const path = await getDiscoveryPath()
  const json = JSON.stringify(info, null, 2)
  // Add a random component to guarantee uniqueness
  const random = randomBytes(6).toString('hex')
  const tmpPath = `${path}.${process.pid}.${random}.tmp`
  await writeFile(tmpPath, json, { mode: 0o600, encoding: 'utf-8' })
  try {
    await rename(tmpPath, path)
  } catch (err) {
    // Best-effort cleanup of the temp file on rename failure
    await unlink(tmpPath).catch(() => undefined)
    throw err
  }
}

/**
 * Reads the discovery file. Returns null if:
 * - The file does not exist
 * - The file cannot be parsed
 * - The recorded PID is no longer running (stale file)
 *
 * On success, returns the parsed DiscoveryInfo.
 */
export async function readDiscoveryFile(): Promise<DiscoveryInfo | null> {
  const path = await getDiscoveryPath()
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (e) {
    if (!isEnoent(e))
      process.stderr.write(
        `  Discovery: read warning (${e instanceof Error ? e.message : String(e)})\n`
      )
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const obj = parsed as { [key: string]: unknown }
  const info = validateDiscoveryFields(obj)
  if (!info) return null
  if (!isProcessAlive(info.pid)) return null

  return info
}

function validateDiscoveryFields(obj: { [key: string]: unknown }): DiscoveryInfo | null {
  const { pid, version, httpPort, authRequired, startedAt, socketPath, authToken } = obj
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return null
  if (typeof version !== 'string') return null
  if (typeof httpPort !== 'number' || !Number.isInteger(httpPort)) return null
  if (httpPort < 0 || httpPort > 65535) return null
  if (typeof authRequired !== 'boolean') return null
  if (typeof startedAt !== 'string') return null
  if (typeof socketPath !== 'string' && socketPath !== null) return null
  if (socketPath === '') return null
  if (authToken !== null && typeof authToken !== 'string') return null
  return { pid, version, httpPort, authRequired, startedAt, socketPath, authToken }
}

/**
 * Removes the discovery file. Does not throw if the file does not exist.
 */
export async function removeDiscoveryFile(): Promise<void> {
  const path = await getDiscoveryPath()
  try {
    await unlink(path)
  } catch (e) {
    if (!isEnoent(e)) throw e
  }
}

// TCP health check is more reliable than Unix socket connections in some
// runtimes (Bun on Linux). We read the discovery file directly instead of
// using readDiscoveryFile() to bypass the isProcessAlive PID check — the
// TCP fetch is a stronger liveness probe than process.kill(pid, 0).
async function isSocketLiveViaTcp(socketPath: string): Promise<boolean> {
  let discoveryPath: string
  try {
    discoveryPath = await getDiscoveryPath()
  } catch {
    return false
  }
  const raw = await readFile(discoveryPath, 'utf-8').catch(() => null)
  if (!raw) return false
  let info: DiscoveryInfo | null = null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      info = validateDiscoveryFields(parsed as { [key: string]: unknown })
    }
  } catch {
    return false
  }
  if (!info || info.socketPath !== socketPath) return false

  // If TCP is disabled (httpPort <= 0), fall back to PID-based liveness check
  if (info.httpPort <= 0) {
    return isProcessAlive(info.pid)
  }

  return fetch(`http://127.0.0.1:${info.httpPort}/health`, {
    signal: AbortSignal.timeout(2000)
  })
    .then((res) => res.ok)
    .catch((e) => {
      // A timeout means the process is likely alive but slow — don't delete its socket
      if (e instanceof Error && e.name === 'TimeoutError') return true
      return false
    })
}

/**
 * Removes a stale Unix domain socket file if it exists and is not live.
 * A socket is considered stale if no process is listening on it.
 */
export async function removeStaleSocket(socketPathOverride?: string): Promise<void> {
  if (!platformHasUnixSockets()) return

  const socketPath = socketPathOverride ?? (await getSocketPath())
  let exists: boolean
  try {
    await access(socketPath, constants.F_OK)
    exists = true
  } catch {
    exists = false
  }

  if (!exists) return

  // Verify the path is actually a socket before unlinking it.
  // A misconfigured OPENPENCIL_MCP_SOCKET could point at a regular file;
  // we must never delete non-socket paths.
  const stat = await lstat(socketPath).catch((e) => {
    if (isEnoent(e)) return null
    throw e
  })
  if (!stat) return
  if (!stat.isSocket()) {
    throw new Error(`Refusing to remove non-socket path: ${socketPath}`)
  }

  if (await isSocketLiveViaTcp(socketPath)) return

  // No live server claims this socket — remove the stale file.
  try {
    await unlink(socketPath)
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code !== 'ENOENT') {
      process.stderr.write(`Failed to remove stale socket: ${e.message}\n`)
    }
  }
}

/**
 * Checks if a process with the given PID is still running.
 * Uses process.kill(pid, 0) which doesn't send a signal, just checks existence.
 * Works on both Unix and Windows.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function isEnoent(e: unknown): boolean {
  return e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT'
}
