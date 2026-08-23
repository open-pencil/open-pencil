import { describe, expect, test } from 'bun:test'

import type { ToolDescriptor } from '@open-pencil/mcp/tools'

import { createMCPRuntimeService, type MCPRuntimeDependencies } from '@/app/automation/mcp/runtime'

function descriptor(name = 'get_page_tree'): ToolDescriptor {
  return {
    name,
    description: name,
    effect: 'read',
    availability: 'default',
    capabilities: ['document:read'],
    enabled: true
  }
}

function setup(overrides: Partial<MCPRuntimeDependencies> = {}) {
  const calls: string[] = []
  const catalogs: ToolDescriptor[][] = []
  const dependencies: MCPRuntimeDependencies = {
    canConnect: () => true,
    connect: () => {
      calls.push('connect')
      return () => calls.push('disconnect-bridge')
    },
    readHealth: async () => ({ status: 'ok', version: '0.14.0', tools: [descriptor()] }),
    setToolDescriptors: (tools) => catalogs.push(tools),
    spawn: async () => ({
      authToken: 'token',
      managed: true,
      disconnect: () => {
        calls.push('disconnect-server')
      }
    }),
    ...overrides
  }
  return { calls, catalogs, service: createMCPRuntimeService(dependencies) }
}

const getStore = () => ({}) as never

describe('MCP runtime service', () => {
  test('starts only after a healthy server response', async () => {
    const { calls, catalogs, service } = setup()

    expect(await service.start(getStore)).toEqual({ ok: true })
    expect(service.state.status).toBe('running')
    expect(service.state.version).toBe('0.14.0')
    expect(calls).toEqual(['connect'])
    expect(catalogs.at(-1)?.map((tool) => tool.name)).toEqual(['get_page_tree'])
  })

  test('serializes refresh behind stop so stale health cannot restore running state', async () => {
    let releaseHealth: (() => void) | undefined
    const blockedHealth = new Promise<void>((resolve) => {
      releaseHealth = resolve
    })
    let healthCalls = 0
    const { service } = setup({
      readHealth: async () => {
        healthCalls++
        if (healthCalls === 2) await blockedHealth
        return { status: 'ok', tools: [descriptor()] }
      }
    })
    await service.start(getStore)

    const refresh = service.refresh()
    const stop = service.stop()
    releaseHealth?.()
    await Promise.all([refresh, stop])

    expect(service.state.status).toBe('stopped')
  })

  test('reports startup failure and cleans up the spawned server', async () => {
    const { calls, service } = setup({ readHealth: async () => null })

    const result = await service.start(getStore)

    expect(result.ok).toBe(false)
    expect(service.state.status).toBe('error')
    expect(service.state.error).toContain('did not become healthy')
    expect(calls).toEqual(['disconnect-server'])
  })

  test('clears local runtime state even when server shutdown fails', async () => {
    const { catalogs, service } = setup({
      spawn: async () => ({
        authToken: 'token',
        managed: true,
        disconnect: () => {
          throw new Error('shutdown failed')
        }
      })
    })
    await service.start(getStore)

    const result = await service.stop()

    expect(result.ok).toBe(false)
    expect(service.state.status).toBe('error')
    expect(service.state.version).toBeNull()
    expect(catalogs.at(-1)).toEqual([])
  })

  test('does not start a replacement when shutdown fails', async () => {
    let spawnCalls = 0
    const { service } = setup({
      spawn: async () => {
        spawnCalls++
        return {
          authToken: 'token',
          managed: true,
          disconnect: () => {
            throw new Error('shutdown failed')
          }
        }
      }
    })
    await service.start(getStore)

    const result = await service.restart()

    expect(result.ok).toBe(false)
    expect(spawnCalls).toBe(1)
    expect(service.state.status).toBe('error')
  })

  test('restarts with the retained editor store inside one lifecycle operation', async () => {
    const { calls, service } = setup()
    await service.start(getStore)

    expect(await service.restart()).toEqual({ ok: true })
    expect(service.state.status).toBe('running')
    expect(calls).toEqual(['connect', 'disconnect-bridge', 'disconnect-server', 'connect'])
  })
})
