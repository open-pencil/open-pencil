import { spawn } from 'node:child_process'
import type { IncomingMessage } from 'node:http'

import type { Plugin } from 'vite'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { getSocketPath, platformHasUnixSockets } from '@open-pencil/mcp/transport'

import {
  DEV_MCP_RESTART_PATH,
  isDevMCPConfiguration,
  type DevMCPConfiguration
} from '../mcp/dev-control'

interface AutomationEnvironmentOptions {
  authToken: string | null
  baseEnv: NodeJS.ProcessEnv
  configuration: DevMCPConfiguration
  corsOrigin: string
  socketPath: string | null
}

export function createAutomationEnvironment(
  options: AutomationEnvironmentOptions
): NodeJS.ProcessEnv {
  const { authToken, baseEnv, configuration, corsOrigin, socketPath } = options
  const childEnv = { ...baseEnv }
  delete childEnv.OPENPENCIL_MCP_SOCKET
  delete childEnv.OPENPENCIL_MCP_AUTH_TOKEN
  return {
    ...childEnv,
    PORT: String(AUTOMATION_HTTP_PORT),
    OPENPENCIL_MCP_TCP: '1',
    ...(socketPath ? { OPENPENCIL_MCP_SOCKET: socketPath } : {}),
    OPENPENCIL_MCP_AUTH_TOKEN: configuration.authenticationEnabled ? (authToken ?? '') : '',
    OPENPENCIL_MCP_CORS_ORIGIN: corsOrigin,
    OPENPENCIL_MCP_ROOT: configuration.rootDirectory.trim() || process.cwd(),
    OPENPENCIL_MCP_DISABLED_TOOLS: configuration.disabledTools
  }
}

async function readConfiguration(request: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of request) {
    body += String(chunk)
    if (body.length > 70_000) throw new Error('Request body is too large')
  }
  return JSON.parse(body)
}

// TODO: production — bundle MCP server as Tauri sidecar or spawn via shell plugin
export function automationPlugin(authToken: string | null, corsOrigin: string): Plugin {
  let child: ReturnType<typeof spawn> | null = null
  let lifecycle = Promise.resolve()
  let configuration: DevMCPConfiguration = {
    authenticationEnabled: true,
    rootDirectory: '',
    disabledTools: ''
  }

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const next = lifecycle.then(operation, operation)
    lifecycle = next.catch(() => undefined)
    return next
  }

  async function stopChild(): Promise<void> {
    const running = child
    if (!running) return
    child = null
    const exited = new Promise<void>((resolve) => {
      running.once('exit', () => resolve())
    })
    running.kill()
    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, 2_000)
    })
    await Promise.race([exited, timeout])
    if (running.exitCode === null) running.kill('SIGKILL')
  }

  async function startChild(): Promise<void> {
    const socketPath = platformHasUnixSockets() ? await getSocketPath() : null
    const spawned = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
      stdio: ['ignore', 'inherit', 'pipe'],
      env: createAutomationEnvironment({
        authToken,
        baseEnv: process.env,
        configuration,
        corsOrigin,
        socketPath
      })
    })
    child = spawned

    spawned.on('error', (err) => {
      console.error(`[MCP] Failed to spawn automation server: ${err.message}`)
      if (child === spawned) child = null
    })

    spawned.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.includes('EADDRINUSE')) {
        console.error(
          `\x1b[31m[MCP] MCP bind failed (port ${AUTOMATION_HTTP_PORT}${socketPath ? ` or socket ${socketPath}` : ''}). Is another OpenPencil instance running?\x1b[0m`
        )
        spawned.kill()
        if (child === spawned) child = null
        return
      }
      process.stderr.write(data)
    })

    spawned.on('exit', (code) => {
      if (code && code !== 0) console.error(`[MCP] Server exited with code ${code}`)
      if (child === spawned) child = null
    })
  }

  async function restartChild(nextConfiguration: DevMCPConfiguration): Promise<void> {
    configuration = nextConfiguration
    await stopChild()
    await startChild()
  }

  return {
    name: 'open-pencil-automation',
    async configureServer(server) {
      server.middlewares.use(DEV_MCP_RESTART_PATH, (request, response, next) => {
        if (request.method !== 'POST') {
          next()
          return
        }
        if (!authToken || request.headers.authorization !== `Bearer ${authToken}`) {
          response.statusCode = 401
          response.end('Unauthorized')
          return
        }
        void (async () => {
          try {
            const nextConfiguration = await readConfiguration(request)
            if (!isDevMCPConfiguration(nextConfiguration)) {
              response.statusCode = 400
              response.end('Invalid MCP configuration')
              return
            }
            await enqueue(() => restartChild(nextConfiguration))
            response.statusCode = 204
            response.end()
          } catch (error) {
            response.statusCode = 500
            response.end(error instanceof Error ? error.message : String(error))
          }
        })()
      })
      await enqueue(startChild)
    },
    async buildEnd() {
      await enqueue(stopChild)
    }
  }
}
