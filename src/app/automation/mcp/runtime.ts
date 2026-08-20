import { reactive } from 'vue'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'

import { connectAutomation } from '@/app/automation/bridge/server'
import type { EditorStore } from '@/app/editor/active-store'
import { isTauri } from '@/app/tauri/env'

import { setMCPToolCatalog } from './preferences'
import { readAutomationHealth, spawnMCPIfNeeded, type AutomationServerHandle } from './spawn'

export type MCPRuntimeStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error'

export const mcpRuntime = reactive({
  status: 'idle' as MCPRuntimeStatus,
  port: AUTOMATION_HTTP_PORT,
  version: null as string | null,
  authRequired: false,
  error: null as string | null,
  checking: false,
  externallyManaged: false
})

let server: AutomationServerHandle | null = null
let disconnectAutomation: (() => void) | null = null
let activeStore: (() => EditorStore) | null = null
let lifecycle = Promise.resolve()

function enqueueLifecycle(operation: () => Promise<void>): Promise<void> {
  const next = lifecycle.then(operation, operation)
  lifecycle = next.catch(() => undefined)
  return next
}

export async function refreshMCPRuntime(): Promise<void> {
  mcpRuntime.checking = true
  try {
    const health = await readAutomationHealth()
    mcpRuntime.version = health?.version ?? null
    mcpRuntime.authRequired = health?.authRequired ?? false
    setMCPToolCatalog(health?.tools ?? [])
    if (health) {
      mcpRuntime.status = 'running'
      mcpRuntime.error = null
    } else if (mcpRuntime.status !== 'starting' && mcpRuntime.status !== 'error') {
      mcpRuntime.status = 'stopped'
    }
  } finally {
    mcpRuntime.checking = false
  }
}

async function start(): Promise<void> {
  mcpRuntime.status = 'starting'
  mcpRuntime.error = null
  mcpRuntime.externallyManaged = false
  try {
    server = await spawnMCPIfNeeded()
    const health = await readAutomationHealth()
    if (!health) throw new Error('MCP server did not become healthy')
    mcpRuntime.externallyManaged = server?.managed === false
    if (activeStore && (import.meta.env.DEV || isTauri())) {
      disconnectAutomation = connectAutomation(activeStore, server?.authToken ?? null).disconnect
    }
    mcpRuntime.version = health.version ?? null
    mcpRuntime.authRequired = health.authRequired ?? false
    setMCPToolCatalog(health.tools ?? [])
    mcpRuntime.status = 'running'
  } catch (error) {
    disconnectAutomation?.()
    disconnectAutomation = null
    if (server) {
      try {
        await server.disconnect()
      } catch (disconnectError) {
        console.warn('[MCP] Failed to stop server after startup error:', disconnectError)
      }
    }
    server = null
    mcpRuntime.status = 'error'
    mcpRuntime.error = error instanceof Error ? error.message : String(error)
    console.warn('[MCP]', error)
  }
}

export function startMCPRuntime(getStore: () => EditorStore): Promise<void> {
  activeStore = getStore
  return enqueueLifecycle(start)
}

async function stop(): Promise<void> {
  disconnectAutomation?.()
  disconnectAutomation = null
  await server?.disconnect()
  server = null
  mcpRuntime.status = 'stopped'
  mcpRuntime.version = null
  mcpRuntime.authRequired = false
  mcpRuntime.externallyManaged = false
  setMCPToolCatalog([])
}

export function stopMCPRuntime(): Promise<void> {
  return enqueueLifecycle(stop)
}

export function restartMCPRuntime(): Promise<void> {
  return enqueueLifecycle(async () => {
    await stop()
    if (!activeStore) throw new Error('Editor is not ready')
    await start()
  })
}
