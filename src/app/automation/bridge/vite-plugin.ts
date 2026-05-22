import { spawn } from 'node:child_process'

import type { Plugin } from 'vite'

// TODO: production — bundle MCP server as Tauri sidecar or spawn via shell plugin
export function automationPlugin(authToken: string | null, corsOrigin: string): Plugin {
  let child: ReturnType<typeof spawn> | null = null
  let cleanupRegistered = false

  const stopChild = () => {
    child?.kill('SIGTERM')
    child = null
  }

  return {
    name: 'open-pencil-automation',
    configureServer() {
      if (child) return

      child = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
        stdio: ['ignore', 'inherit', 'pipe'],
        env: {
          ...process.env,
          PORT: process.env.MCP_HTTP_PORT ?? '7600',
          WS_PORT: process.env.MCP_WS_PORT ?? '7601',
          ...(authToken ? { OPENPENCIL_MCP_AUTH_TOKEN: authToken } : {}),
          OPENPENCIL_MCP_CORS_ORIGIN: corsOrigin
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (text.includes('EADDRINUSE')) {
          const port = process.env.MCP_HTTP_PORT ?? '7600'
          console.error(
            `\x1b[31m[MCP] Port ${port} already in use. Is another OpenPencil instance running?\x1b[0m`
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

      if (!cleanupRegistered) {
        cleanupRegistered = true
        process.once('exit', stopChild)
        process.once('SIGINT', () => {
          stopChild()
          process.exit(130)
        })
        process.once('SIGTERM', () => {
          stopChild()
          process.exit(143)
        })
      }
    },
    buildEnd() {
      stopChild()
    }
  }
}
