import { spawn } from 'node:child_process'

import type { Plugin } from 'vite'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { getSocketPath, platformHasUnixSockets } from '@open-pencil/mcp/transport'

// TODO: production — bundle MCP server as Tauri sidecar or spawn via shell plugin
export function automationPlugin(authToken: string | null, corsOrigin: string): Plugin {
  let child: ReturnType<typeof spawn> | null = null

  return {
    name: 'open-pencil-automation',
    async configureServer() {
      if (child) return

      // Only resolve and forward the socket path on platforms that support
      // Unix domain sockets. On Windows the MCP server falls back to TCP,
      // and forwarding OPENPENCIL_MCP_SOCKET would cause it to attempt a
      // socket listen that cannot succeed.
      const socketPath = platformHasUnixSockets() ? await getSocketPath() : null

      child = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
        stdio: ['ignore', 'inherit', 'pipe'],
        env: {
          ...process.env,
          PORT: String(AUTOMATION_HTTP_PORT),
          OPENPENCIL_MCP_TCP: '1',
          ...(socketPath ? { OPENPENCIL_MCP_SOCKET: socketPath } : {}),
          ...(authToken ? { OPENPENCIL_MCP_AUTH_TOKEN: authToken } : {}),
          OPENPENCIL_MCP_CORS_ORIGIN: corsOrigin,
          OPENPENCIL_MCP_ROOT: process.cwd()
        }
      })

      child.on('error', (err) => {
        console.error(`[MCP] Failed to spawn automation server: ${err.message}`)
        child = null
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (text.includes('EADDRINUSE')) {
          console.error(
            `\x1b[31m[MCP] MCP bind failed (port ${AUTOMATION_HTTP_PORT}${socketPath ? ` or socket ${socketPath}` : ''}). Is another OpenPencil instance running?\x1b[0m`
          )
          child?.kill()
          child = null
          return
        }
        process.stderr.write(data)
      })

      child.on('exit', (code) => {
        if (code && code !== 0 && child) {
          console.error(`[MCP] Server exited with code ${code}`)
        }
        child = null
      })
    },
    buildEnd() {
      child?.kill()
      child = null
    }
  }
}
