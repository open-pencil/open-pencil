import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'
import type { WebMCP } from 'webmcp-types'

import { ALL_TOOLS, isToolExposed, type ToolDef } from '@open-pencil/core/tools'

import { getWebMCPTools, resolveWebMCPMode, type WebMCPMode } from '@/app/automation/webmcp/policy'
import { createWebMCPRuntimeService } from '@/app/automation/webmcp/service'

function createHost() {
  const tools = new Map<string, WebMCP.ModelContextTool>()
  return {
    tools,
    async registerTool(
      tool: WebMCP.ModelContextTool,
      options?: WebMCP.ModelContextRegisterToolOptions
    ) {
      if (tools.has(tool.name)) throw new Error('Duplicate tool')
      tools.set(tool.name, tool)
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name), { once: true })
    }
  }
}

async function ready(service: ReturnType<typeof createWebMCPRuntimeService>) {
  for (let attempt = 0; attempt < 1000 && service.state.status === 'starting'; attempt++) {
    await Promise.resolve()
  }
  expect(service.state.status).toBe('ready')
}

describe('WebMCP access preferences', () => {
  test('default inclusion cannot override execution support or user access', () => {
    const base = ALL_TOOLS[0]
    if (!base) throw new Error('Missing tool fixture')
    const read: ToolDef = {
      ...base,
      name: 'read',
      execution: { kind: 'sync', mutation: 'none' },
      mutates: false,
      exposure: {}
    }
    const edit: ToolDef = {
      ...read,
      name: 'edit',
      execution: { kind: 'sync', mutation: 'properties' },
      mutates: true
    }
    const tools: ToolDef[] = [
      read,
      edit,
      { ...read, name: 'excluded', exposure: { webmcp: false } },
      {
        ...edit,
        name: 'structural',
        execution: { kind: 'sync', mutation: 'document' },
        exposure: { webmcp: true }
      },
      { ...edit, name: 'async', execution: { kind: 'async', mutation: 'document' } }
    ]
    expect(getWebMCPTools('off', tools)).toEqual([])
    expect(getWebMCPTools('inspect', tools).map((tool) => tool.name)).toEqual(['read'])
    expect(getWebMCPTools('edit', tools).map((tool) => tool.name)).toEqual(['read', 'edit'])
  })

  test('unrecognized stored access fails closed', () => {
    for (const value of [undefined, null, true, {}, 'all', 'EDIT']) {
      expect(resolveWebMCPMode(value)).toBe('off')
    }
    for (const mode of ['off', 'inspect', 'edit'] as const) {
      expect(resolveWebMCPMode(mode)).toBe(mode)
    }
    expect(getWebMCPTools('off')).toEqual([])
    expect(getWebMCPTools('inspect').length).toBeGreaterThan(0)
    expect(getWebMCPTools('inspect').every((tool) => !tool.mutates)).toBe(true)
    expect(getWebMCPTools('edit').some((tool) => tool.mutates)).toBe(true)
    expect(getWebMCPTools('edit').every((tool) => isToolExposed(tool, 'webmcp'))).toBe(true)
  })

  test('reconfigures access and revokes retained callbacks immediately', async () => {
    const context = createHost()
    const service = createWebMCPRuntimeService()
    const mode = ref<WebMCPMode>('off')
    let executions = 0
    const stop = service.start(context, mode, () => ({ execute: async () => ++executions }))
    try {
      expect(service.state.status).toBe('off')
      expect(context.tools.size).toBe(0)
      mode.value = 'edit'
      await ready(service)
      const retained = context.tools.get('set_fill')
      if (!retained) throw new Error('Missing editing tool')
      mode.value = 'inspect'
      await expect(
        retained.execute({ id: 'node', color: '#ffffff' }, { signal: new AbortController().signal })
      ).rejects.toThrow()
      expect(executions).toBe(0)
      await ready(service)
      expect(context.tools.size).toBe(getWebMCPTools('inspect').length)
      expect(service.state.toolCount).toBe(context.tools.size)
      expect(context.tools.has('set_fill')).toBe(false)
      mode.value = 'off'
      expect(context.tools.size).toBe(0)
      expect(service.state.status).toBe('off')
    } finally {
      stop()
    }
  })

  test('serializes interrupted registrations and stops watching on disposal', async () => {
    const context = createHost()
    const mode = ref<WebMCPMode>('edit')
    const service = createWebMCPRuntimeService()
    const stop = service.start(context, mode, () => ({ execute: async () => null }))
    await Promise.resolve()
    mode.value = 'inspect'
    mode.value = 'off'
    mode.value = 'edit'
    await ready(service)
    expect(context.tools.size).toBe(getWebMCPTools('edit').length)
    stop()
    mode.value = 'inspect'
    await Promise.resolve()
    expect(context.tools.size).toBe(0)
    expect(service.state.status).toBe('off')
  })

  test('reports unsupported browsers and registration errors', async () => {
    const service = createWebMCPRuntimeService()
    const mode = ref<WebMCPMode>('inspect')
    service.start(undefined, mode, () => ({ execute: async () => null }))
    expect(service.state.status).toBe('unsupported')
    service.start(
      {
        registerTool: async () => {
          throw new Error('Permission denied')
        }
      },
      mode,
      () => ({ execute: async () => null })
    )
    for (let attempt = 0; attempt < 100 && service.state.status === 'starting'; attempt++)
      await Promise.resolve()
    expect(service.state).toMatchObject({
      status: 'error',
      toolCount: 0,
      error: 'Permission denied'
    })
    service.stop()
  })
})
