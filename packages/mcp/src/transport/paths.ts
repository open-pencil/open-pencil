import { mkdir } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Platform-specific paths for the MCP server's Unix domain socket
 * and the discovery JSON file.
 *
 * Socket directory layout (overridable via OPENPENCIL_MCP_SOCKET):
 *   macOS:   ~/Library/Application Support/OpenPencil/
 *   Linux:   $XDG_RUNTIME_DIR/openpencil/  (fallback: ~/.openpencil/)
 *   Windows: %LOCALAPPDATA%\OpenPencil\  (fallback: ~\AppData\Local\OpenPencil\)
 *
 * On Windows, Unix domain sockets are unavailable — the server uses TCP only.
 *
 * Discovery file: always at the platform-default path above (NOT moved by
 * OPENPENCIL_MCP_SOCKET). The socket override is recorded in the discovery
 * file's `socketPath` field so clients read it from the well-known location.
 * Socket file:     <socketDir>/mcp.sock  (or the override path)
 *
 * IMPORTANT: getSocketDir() returns the directory that contains the socket
 * file. It does NOT always contain the discovery file — when
 * OPENPENCIL_MCP_SOCKET is set, the discovery file stays at getPlatformDir().
 */

const DIR_NAME_UNIX = 'openpencil'
const DIR_NAME_MACOS = 'OpenPencil'
const SOCKET_FILENAME = 'mcp.sock'
const DISCOVERY_FILENAME = 'mcp.json'

const isMacOS = platform() === 'darwin'
const isWindows = platform() === 'win32'

/**
 * Returns the platform-specific default directory for MCP runtime files,
 * ignoring OPENPENCIL_MCP_SOCKET. The discovery file always lives here so
 * clients can find it at a well-known location regardless of socket overrides.
 * Creates the directory (with restrictive permissions) if it does not exist.
 *
 * The 0o700 mode restricts permissions on Unix. On Windows, mkdir ignores
 * the mode and uses default ACLs — directory access is controlled by the
 * filesystem, not the permission bits.
 */
async function getPlatformDir(): Promise<string> {
  let dir: string

  if (isMacOS) {
    dir = join(homedir(), 'Library', 'Application Support', DIR_NAME_MACOS)
  } else if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA?.trim()
    if (localAppData) {
      dir = join(localAppData, DIR_NAME_MACOS)
    } else {
      dir = join(homedir(), 'AppData', 'Local', DIR_NAME_MACOS)
    }
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
 * Returns the directory for the MCP socket file.
 *
 * When OPENPENCIL_MCP_SOCKET is set, its dirname is used as the socket
 * directory. When unset, the platform default from getPlatformDir() is used.
 * Creates the directory (with restrictive permissions) if it does not exist.
 *
 * NOTE: The discovery file always lives at getPlatformDir(), regardless of
 * OPENPENCIL_MCP_SOCKET. This function should NOT be used to locate it.
 */
export async function getSocketDir(): Promise<string> {
  const socketOverride = process.env.OPENPENCIL_MCP_SOCKET?.trim()

  if (socketOverride) {
    const dir = dirname(socketOverride)
    await mkdir(dir, { recursive: true, mode: 0o700 })
    return dir
  }

  return getPlatformDir()
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
  if (socketOverride) {
    // Ensure the override directory exists. getSocketDir() creates the
    // directory for the custom socket path (dirname of the override).
    await getSocketDir()
    return socketOverride
  }

  const dir = await getSocketDir()
  return join(dir, SOCKET_FILENAME)
}

/**
 * Returns the full path to the MCP discovery JSON file.
 *
 * The discovery file always lives at the platform-default location so clients
 * can find it without knowing whether OPENPENCIL_MCP_SOCKET is set. It contains
 * the actual socket path (which may be overridden) in its `socketPath` field,
 * so clients read the discovery file to learn where to connect — not the other
 * way around.
 */
export async function getDiscoveryPath(): Promise<string> {
  const dir = await getPlatformDir()
  return join(dir, DISCOVERY_FILENAME)
}

/**
 * Returns true if the current platform supports Unix domain sockets.
 * Unix domain sockets are available on macOS, Linux, and other POSIX
 * platforms but not on native Windows. WSL is detected as Linux.
 */
export function platformHasUnixSockets(): boolean {
  return process.platform !== 'win32'
}

/**
 * Returns the platform name for display purposes.
 */
export function platformName(): 'macos' | 'linux' | 'windows' | 'other' {
  if (isMacOS) return 'macos'
  if (isWindows) return 'windows'
  if (platform() === 'linux') return 'linux'
  return 'other'
}
