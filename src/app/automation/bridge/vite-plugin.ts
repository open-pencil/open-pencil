import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Plugin } from 'vite'

import { serializeDisabledTools } from '@open-pencil/mcp/tools'
import { platformHasUnixSockets } from '@open-pencil/mcp/transport'

import {
  DEV_MCP_RESTART_PATH,
  parseDevMCPConfiguration,
  type DevMCPConfiguration
} from '../mcp/dev-control'

interface AutomationEnvironmentOptions {
  authToken: string | null
  baseEnv: NodeJS.ProcessEnv
  configuration: DevMCPConfiguration
  corsOrigin: string
  discoveryPath: string | null
  httpPort: number
  socketPath: string | null
}

export function createAutomationEnvironment(
  options: AutomationEnvironmentOptions
): NodeJS.ProcessEnv {
  const { authToken, baseEnv, configuration, corsOrigin, discoveryPath, httpPort, socketPath } =
    options
  const childEnv = { ...baseEnv }
  delete childEnv.OPENPENCIL_MCP_SOCKET
  delete childEnv.OPENPENCIL_MCP_AUTH_TOKEN
  const environment: NodeJS.ProcessEnv = {
    ...childEnv,
    PORT: String(httpPort),
    OPENPENCIL_MCP_TCP: '1',
    OPENPENCIL_MCP_AUTH_TOKEN: configuration.authenticationEnabled ? (authToken ?? '') : '',
    OPENPENCIL_MCP_CORS_ORIGIN: corsOrigin,
    OPENPENCIL_MCP_ROOT: configuration.rootDirectory.trim() || process.cwd(),
    OPENPENCIL_MCP_DISABLED_TOOLS: serializeDisabledTools(configuration.disabledTools)
  }
  if (socketPath) environment.OPENPENCIL_MCP_SOCKET = socketPath
  if (discoveryPath) environment.OPENPENCIL_MCP_DISCOVERY_PATH = discoveryPath
  return environment
}

const MAX_CONFIGURATION_BYTES = 70_000
const CHILD_EXIT_TIMEOUT_MS = 2_000
const CHILD_HEALTH_ATTEMPTS = 200
const CHILD_HEALTH_DELAY_MS = 50

type DevMCPConfigurationErrorStatus = 400 | 413

class DevMCPConfigurationRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: DevMCPConfigurationErrorStatus,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'DevMCPConfigurationRequestError'
  }
}

export class DevMCPConfigurationTooLargeError extends DevMCPConfigurationRequestError {
  constructor() {
    super('Request body is too large', 413)
    this.name = 'DevMCPConfigurationTooLargeError'
  }
}

export class DevMCPConfigurationSyntaxError extends DevMCPConfigurationRequestError {
  constructor(cause: unknown) {
    super('Malformed JSON configuration', 400, { cause })
    this.name = 'DevMCPConfigurationSyntaxError'
  }
}

export function devMCPConfigurationErrorStatus(error: unknown): 400 | 413 | 500 {
  return error instanceof DevMCPConfigurationRequestError ? error.statusCode : 500
}

export async function readDevMCPConfiguration(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.byteLength
    if (byteLength > MAX_CONFIGURATION_BYTES) throw new DevMCPConfigurationTooLargeError()
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (error) {
    throw new DevMCPConfigurationSyntaxError(error)
  }
}

export async function waitForAutomationHealth(
  browserURL: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  const healthURL = `${browserURL.replace(/^ws/, 'http')}/health`
  for (let attempt = 0; attempt < CHILD_HEALTH_ATTEMPTS; attempt++) {
    try {
      const response = await fetcher(healthURL)
      if (response.ok) return
    } catch (error) {
      if (attempt === CHILD_HEALTH_ATTEMPTS - 1) {
        console.warn(`[MCP] Health check failed at ${healthURL}`, error)
      }
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, CHILD_HEALTH_DELAY_MS)
    })
  }
  throw new Error(`MCP server did not become healthy at ${healthURL}`)
}

interface AutomationPluginOptions {
  browserURL: string
  corsOrigin: string
  httpPort: number
  portlessServiceName: string | null
  runtimeId: string
}

function safeRuntimeId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export function configurationsMatch(
  current: DevMCPConfiguration,
  next: DevMCPConfiguration
): boolean {
  return (
    current.authenticationEnabled === next.authenticationEnabled &&
    current.rootDirectory === next.rootDirectory &&
    current.disabledTools.length === next.disabledTools.length &&
    current.disabledTools.every((tool, index) => tool === next.disabledTools[index])
  )
}

// TODO: production — bundle MCP server as Tauri sidecar or spawn via shell plugin
export function automationPlugin(
  authToken: string | null,
  options: AutomationPluginOptions
): Plugin {
  let child: ReturnType<typeof spawn> | null = null
  let lifecycle = Promise.resolve()
  let configuration: DevMCPConfiguration = {
    authenticationEnabled: true,
    rootDirectory: '',
    disabledTools: []
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
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(true), CHILD_EXIT_TIMEOUT_MS)
    })
    const exitedGracefully = await Promise.race([exited.then(() => false), timedOut])
    if (timeout) clearTimeout(timeout)
    if (!exitedGracefully && running.exitCode === null) {
      running.kill('SIGKILL')
      await exited
    }
  }

  async function startChild(): Promise<void> {
    const runtimeDir = join(tmpdir(), 'open-pencil-mcp', safeRuntimeId(options.runtimeId))
    await mkdir(runtimeDir, { recursive: true, mode: 0o700 })
    const socketPath = platformHasUnixSockets() ? join(runtimeDir, 'mcp.sock') : null
    const discoveryPath = join(runtimeDir, 'mcp.json')
    const command = ['bun', 'run', 'packages/mcp/src/index.ts']
    const spawnCommand = options.portlessServiceName ? 'portless' : command[0]
    const spawnArgs = options.portlessServiceName
      ? ['run', '--name', options.portlessServiceName, ...command]
      : command.slice(1)
    const spawned = spawn(spawnCommand, spawnArgs, {
      stdio: ['ignore', 'inherit', 'pipe'],
      env: createAutomationEnvironment({
        authToken,
        baseEnv: process.env,
        configuration,
        corsOrigin: options.corsOrigin,
        discoveryPath,
        httpPort: options.httpPort,
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
          `\x1b[31m[MCP] MCP bind failed (${options.browserURL}${socketPath ? ` or socket ${socketPath}` : ''}). Is another OpenPencil instance running?\x1b[0m`
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

    await waitForAutomationHealth(options.browserURL)
  }

  async function restartChild(nextConfiguration: DevMCPConfiguration): Promise<void> {
    if (child && configurationsMatch(configuration, nextConfiguration)) return
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
            const rawConfiguration = await readDevMCPConfiguration(request)
            const nextConfiguration = parseDevMCPConfiguration(rawConfiguration)
            if (!nextConfiguration) {
              response.statusCode = 400
              response.end('Invalid MCP configuration')
              return
            }
            await enqueue(() => restartChild(nextConfiguration))
            response.statusCode = 204
            response.end()
          } catch (error) {
            response.statusCode = devMCPConfigurationErrorStatus(error)
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
