import { reactive } from 'vue'

import { connectAutomation } from '@/app/automation/bridge/server'
import type { EditorStore } from '@/app/editor/active-store'
import { isTauri } from '@/app/tauri/env'

import { mcpFailure, type MCPFailure } from './failure'
import { setMCPToolDescriptors } from './preferences'
import {
  type AutomationHealth,
  type AutomationServerHandle,
  readAutomationHealth,
  getAutomationHealthFailure,
  getAutomationStartupFailure,
  getMCPServerURL,
  spawnMCPIfNeeded
} from './spawn'

export type MCPRuntimeStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error'

export interface MCPRuntimeState {
  status: MCPRuntimeStatus
  endpoint: string
  version: string | null
  /** Structured reason the server is unavailable; Settings renders translated copy. */
  failure: MCPFailure | null
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
  /** Diagnostics for the most recent spawn/health attempt. */
  getStartupFailure: () => MCPFailure | null
  getHealthFailure: () => MCPFailure | null
}

/**
 * Turn a failed startup into the reason the user can act on. The spawn layer
 * records the real cause; without it every failure reads as one generic message.
 */
function describeStartupFailure(
  dependencies: MCPRuntimeDependencies,
  spawned: AutomationServerHandle | null
): MCPFailure {
  const startupFailure = dependencies.getStartupFailure()
  if (!spawned && startupFailure) return startupFailure

  const healthFailure = dependencies.getHealthFailure()
  if (healthFailure?.code === 'rejected' || healthFailure?.code === 'malformed') {
    return healthFailure
  }
  if (startupFailure) return startupFailure
  return mcpFailure('unreachable', getMCPServerURL())
}

/** Technical summary for logs; the UI renders translated copy from the code. */
function failureDetail(failure: MCPFailure): string {
  return failure.detail ? `${failure.code}: ${failure.detail}` : failure.code
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function createMCPRuntimeService(dependencies: MCPRuntimeDependencies) {
  const state = reactive<MCPRuntimeState>({
    status: 'idle',
    endpoint: getMCPServerURL(),
    version: null,
    failure: null,
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
    dependencies.setToolDescriptors(health.tools ?? [])
    state.status = 'running'
    state.failure = null
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
      dependencies.setToolDescriptors([])
      if (state.status !== 'error') state.status = 'stopped'
      return { ok: true }
    } catch (error) {
      const runtimeError = toError(error)
      state.status = 'error'
      state.failure = mcpFailure('unreachable', runtimeError.message)
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
    state.failure = null
    state.externallyManaged = false
    let failure: MCPFailure | null = null
    let thrown: Error | null = null
    try {
      server = await dependencies.spawn()
      const health = await dependencies.readHealth(server?.authToken)
      if (health) {
        state.externallyManaged = server?.managed === false
        if (activeStore && dependencies.canConnect()) {
          disconnectAutomation = dependencies.connect(activeStore, server?.authToken ?? null)
        }
        applyHealth(health)
        return { ok: true }
      }
      failure = describeStartupFailure(dependencies, server)
    } catch (error) {
      thrown = toError(error)
      failure = describeStartupFailure(dependencies, server)
    }

    const disconnectError = await disconnectCurrentServer()
    const detail = failureDetail(failure)
    state.status = 'error'
    state.failure = failure
    if (thrown) console.warn('[MCP]', detail, thrown)
    else console.warn('[MCP]', detail)
    return {
      ok: false,
      error: disconnectError
        ? new Error(`${detail}. Cleanup failed: ${disconnectError.message}`)
        : new Error(detail)
    }
  }

  async function stopOperation(releaseStore: boolean): Promise<MCPRuntimeResult> {
    const disconnectError = await disconnectCurrentServer()
    if (releaseStore) activeStore = null
    state.status = disconnectError ? 'error' : 'stopped'
    state.version = null
    state.failure = disconnectError ? mcpFailure('unknown', disconnectError.message) : null
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
          state.failure = null
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
  spawn: spawnMCPIfNeeded,
  getStartupFailure: getAutomationStartupFailure,
  getHealthFailure: getAutomationHealthFailure
})

export const mcpRuntime = appMCPRuntime.state
export const refreshMCPRuntime = appMCPRuntime.refresh
export const restartMCPRuntime = () => appMCPRuntime.restart()
export const startMCPRuntime = (getStore: () => EditorStore) => appMCPRuntime.start(getStore)
export const stopMCPRuntime = () => appMCPRuntime.stop()
