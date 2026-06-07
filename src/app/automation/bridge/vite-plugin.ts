import { spawn } from 'node:child_process'

import type { Plugin } from 'vite'

import { getSocketPath } from '@open-pencil/mcp/transport'

// TODO: production — bundle MCP server as Tauri sidecar or spawn via shell plugin
export function automationPlugin(authToken: string | null, corsOrigin: string): Plugin {
  let child: ReturnType<typeof spawn> | null = null

  return {
    name: 'open-pencil-automation',
    async configureServer() {
      if (child) return

      const socketPath = await getSocketPath()

      child = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
        stdio: ['ignore', 'inherit', 'pipe'],
        env: {
          ...process.env,
          PORT: '7600',
          OPENPENCIL_MCP_TCP: '1',
          OPENPENCIL_MCP_SOCKET: socketPath,
          ...(authToken ? { OPENPENCIL_MCP_AUTH_TOKEN: authToken } : {}),
          OPENPENCIL_MCP_CORS_ORIGIN: corsOrigin,
          OPENPENCIL_MCP_ROOT: process.cwd()
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (text.includes('EADDRINUSE')) {
          console.error(
            '\x1b[31m[MCP] Port 7600 already in use. Is another OpenPencil instance running?\x1b[0m'
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
