import { mkdir } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Platform-specific paths for the MCP server's Unix domain socket
 * and the discovery JSON file.
 *
 * Socket directory layout:
 *   macOS:   ~/Library/Application Support/OpenPencil/
 *   Linux:   $XDG_RUNTIME_DIR/openpencil/  (fallback: ~/.openpencil/)
 *
 * Discovery file: <socketDir>/mcp.json
 * Socket file:     <socketDir>/mcp.sock
 */

const DIR_NAME_UNIX = 'openpencil'
const DIR_NAME_MACOS = 'OpenPencil'
const SOCKET_FILENAME = 'mcp.sock'
const DISCOVERY_FILENAME = 'mcp.json'

const isMacOS = platform() === 'darwin'

/**
 * Returns the platform-appropriate directory for MCP runtime files.
 * Creates the directory (with restrictive permissions) if it does not exist.
 *
 * The OPENPENCIL_MCP_SOCKET env var, when set, overrides the directory:
 * its dirname is used as the socket directory.
 */
export async function getSocketDir(): Promise<string> {
  const socketOverride = process.env.OPENPENCIL_MCP_SOCKET?.trim()

  let dir: string

  if (socketOverride) {
    dir = dirname(socketOverride)
  } else if (isMacOS) {
    dir = join(homedir(), 'Library', 'Application Support', DIR_NAME_MACOS)
  } else {
    // Linux / other Unix
    const xdgRuntime = process.env.XDG_RUNTIME_DIR?.trim()
    if (xdgRuntime) {
      dir = join(xdgRuntime, DIR_NAME_UNIX)
    } else {
      dir = join(homedir(), `.${DIR_NAME_UNIX}`)
    }
  }

  await mkdir(dir, { recursive: true, mode: 0o700 })

  return dir
}

/**
 * Returns the full path to the MCP Unix domain socket.
 *
 * On macOS/Linux: <socketDir>/mcp.sock
 *
 * When OPENPENCIL_MCP_SOCKET is set, its value is returned directly
 * (no directory resolution needed).
 */
export async function getSocketPath(): Promise<string> {
  const socketOverride = process.env.OPENPENCIL_MCP_SOCKET?.trim()
  if (socketOverride) return socketOverride

  const dir = await getSocketDir()
  return join(dir, SOCKET_FILENAME)
}

/**
 * Returns the full path to the MCP discovery JSON file.
 *
 * The discovery file contains runtime metadata (PID, socket path, HTTP port,
 * version) so that clients can auto-discover the running server.
 *
 * When OPENPENCIL_MCP_SOCKET is set, the discovery file is placed
 * alongside the socket (same directory).
 */
export async function getDiscoveryPath(): Promise<string> {
  const socketOverride = process.env.OPENPENCIL_MCP_SOCKET?.trim()

  if (socketOverride) {
    return join(dirname(socketOverride), DISCOVERY_FILENAME)
  }

  const dir = await getSocketDir()
  return join(dir, DISCOVERY_FILENAME)
}

/**
 * Returns true if the current platform supports Unix domain sockets.
 */
export function platformHasUnixSockets(): boolean {
  return true
}

/**
 * Returns the platform name for display purposes.
 */
export function platformName(): 'macos' | 'linux' | 'other' {
  if (isMacOS) return 'macos'
  if (platform() === 'linux') return 'linux'
  return 'other'
}
