import { reactive } from 'vue'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'

import { connectAutomation } from '@/app/automation/bridge/server'
import type { EditorStore } from '@/app/editor/active-store'
import { isTauri } from '@/app/tauri/env'

import { setMCPToolDescriptors } from './preferences'
import {
  type AutomationHealth,
  type AutomationServerHandle,
  readAutomationHealth,
  spawnMCPIfNeeded
} from './spawn'

export type MCPRuntimeStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error'

export interface MCPRuntimeState {
  status: MCPRuntimeStatus
  port: number
  version: string | null
  authRequired: boolean
  corsOrigin: string | null
  error: string | null
  checking: boolean
  externallyManaged: boolean
}

export type MCPRuntimeResult = { ok: true } | { ok: false; error: Error }

export interface MCPRuntimeDependencies {
  connect: (getStore: () => EditorStore, authToken: string | null) => () => void
  canConnect: () => boolean
  readHealth: (authToken?: string | null) => Promise<AutomationHealth | null>
  setToolDescriptors: (tools: NonNullable<AutomationHealth['tools']>) => void
  spawn: () => Promise<AutomationServerHandle | null>
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function createMCPRuntimeService(dependencies: MCPRuntimeDependencies) {
  const state = reactive<MCPRuntimeState>({
    status: 'idle',
    port: AUTOMATION_HTTP_PORT,
    version: null,
    authRequired: false,
    corsOrigin: null,
    error: null,
    checking: false,
    externallyManaged: false
  })

  let server: AutomationServerHandle | null = null
  let disconnectAutomation: (() => void) | null = null
  let activeStore: (() => EditorStore) | null = null
  let lifecycle: Promise<void> = Promise.resolve()

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = lifecycle.then(operation, operation)
    lifecycle = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  function applyHealth(health: AutomationHealth): void {
    state.version = health.version ?? null
    state.authRequired = health.authRequired ?? false
    state.corsOrigin = health.corsOrigin ?? null
    dependencies.setToolDescriptors(health.tools ?? [])
    state.status = 'running'
    state.error = null
  }

  async function refreshOperation(): Promise<MCPRuntimeResult> {
    state.checking = true
    try {
      const health = await dependencies.readHealth(server?.authToken)
      if (health) {
        applyHealth(health)
        return { ok: true }
      }
      state.version = null
      state.authRequired = false
      state.corsOrigin = null
      dependencies.setToolDescriptors([])
      if (state.status !== 'error') state.status = 'stopped'
      return { ok: true }
    } catch (error) {
      const runtimeError = toError(error)
      state.status = 'error'
      state.error = runtimeError.message
      return { ok: false, error: runtimeError }
    } finally {
      state.checking = false
    }
  }

  async function disconnectCurrentServer(): Promise<Error | null> {
    disconnectAutomation?.()
    disconnectAutomation = null
    const currentServer = server
    server = null
    try {
      await currentServer?.disconnect()
      return null
    } catch (error) {
      return toError(error)
    }
  }

  async function startOperation(): Promise<MCPRuntimeResult> {
    state.status = 'starting'
    state.error = null
    state.externallyManaged = false
    try {
      server = await dependencies.spawn()
      const health = await dependencies.readHealth(server?.authToken)
      if (!health) throw new Error('MCP server did not become healthy')
      state.externallyManaged = server?.managed === false
      if (activeStore && dependencies.canConnect()) {
        disconnectAutomation = dependencies.connect(activeStore, server?.authToken ?? null)
      }
      applyHealth(health)
      return { ok: true }
    } catch (error) {
      const runtimeError = toError(error)
      const disconnectError = await disconnectCurrentServer()
      state.status = 'error'
      state.error = disconnectError
        ? `${runtimeError.message}. Cleanup failed: ${disconnectError.message}`
        : runtimeError.message
      console.warn('[MCP]', runtimeError)
      return { ok: false, error: runtimeError }
    }
  }

  async function stopOperation(releaseStore: boolean): Promise<MCPRuntimeResult> {
    const disconnectError = await disconnectCurrentServer()
    if (releaseStore) activeStore = null
    state.status = disconnectError ? 'error' : 'stopped'
    state.version = null
    state.authRequired = false
    state.corsOrigin = null
    state.error = disconnectError?.message ?? null
    state.externallyManaged = false
    dependencies.setToolDescriptors([])
    return disconnectError ? { ok: false, error: disconnectError } : { ok: true }
  }

  return {
    state,
    refresh: () => enqueue(refreshOperation),
    start(getStore: () => EditorStore): Promise<MCPRuntimeResult> {
      activeStore = getStore
      return enqueue(startOperation)
    },
    stop: () => enqueue(() => stopOperation(true)),
    restart: () =>
      enqueue(async () => {
        const stopResult = await stopOperation(false)
        if (!stopResult.ok) return stopResult
        if (!activeStore) {
          const error = new Error('Editor is not ready')
          state.status = 'error'
          state.error = error.message
          return { ok: false, error } as MCPRuntimeResult
        }
        return startOperation()
      })
  }
}

const appMCPRuntime = createMCPRuntimeService({
  connect: (getStore, authToken) => connectAutomation(getStore, authToken).disconnect,
  canConnect: () => import.meta.env.DEV || isTauri(),
  readHealth: readAutomationHealth,
  setToolDescriptors: setMCPToolDescriptors,
  spawn: spawnMCPIfNeeded
})

export const mcpRuntime = appMCPRuntime.state
export const refreshMCPRuntime = appMCPRuntime.refresh
export const restartMCPRuntime = () => appMCPRuntime.restart()
export const startMCPRuntime = (getStore: () => EditorStore) => appMCPRuntime.start(getStore)
export const stopMCPRuntime = () => appMCPRuntime.stop()
