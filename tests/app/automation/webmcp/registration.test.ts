import { describe, expect, test } from 'bun:test'

import type { WebMCP } from 'webmcp-types'

import { registerWebMCPTools } from '@/app/automation/webmcp/registration'

function host() {
  const tools = new Map<string, WebMCP.ModelContextTool>()
  return {
    tools,
    async registerTool(
      tool: WebMCP.ModelContextTool,
      options?: WebMCP.ModelContextRegisterToolOptions
    ) {
      tools.set(tool.name, tool)
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name), { once: true })
    }
  }
}

function requiredTool(tools: Map<string, WebMCP.ModelContextTool>, name: string) {
  const tool = tools.get(name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return tool
}

const options = () => ({ signal: new AbortController().signal })

describe('WebMCP registration', () => {
  test('unsupported browsers do nothing', async () => {
    const registration = registerWebMCPTools(
      undefined,
      () => {
        throw new Error('Must not resolve an editor')
      },
      'edit'
    )
    await registration.ready
    registration.dispose()
  })

  test('registers only reviewed tools and unregisters on disposal', async () => {
    const context = host()
    const registration = registerWebMCPTools(context, () => ({ execute: async () => ({}) }), 'edit')
    await registration.ready
    expect(context.tools.has('get_node')).toBe(true)
    for (const name of [
      'eval',
      'render',
      'save_file',
      'delete_node',
      'create_variable',
      'set_image_fill'
    ]) {
      expect(context.tools.has(name)).toBe(false)
    }
    expect(context.tools.get('get_node')?.annotations?.readOnlyHint).toBe(true)
    expect(context.tools.get('set_fill')?.annotations?.readOnlyHint).toBe(false)
    for (const tool of context.tools.values()) {
      expect(tool.annotations?.untrustedContentHint).toBe(true)
      expect(tool.inputSchema).toMatchObject({ type: 'object' })
    }
    registration.dispose()
    expect(context.tools.size).toBe(0)
  })

  test('validates before execution and captures the target for each call', async () => {
    const context = host()
    let active = 'first'
    let calls = 0
    const registration = registerWebMCPTools(
      context,
      () => {
        const captured = active
        return {
          execute: async () => {
            calls++
            await Promise.resolve()
            return { document: captured }
          }
        }
      },
      'edit'
    )
    await registration.ready
    try {
      const tool = requiredTool(context.tools, 'get_node')
      await expect(tool.execute({}, options())).rejects.toThrow()
      expect(calls).toBe(0)
      const pending = tool.execute({ id: 'node' }, options())
      active = 'second'
      expect(await pending).toBe('{"document":"first"}')
      expect(await tool.execute({ id: 'node' }, options())).toBe('{"document":"second"}')
    } finally {
      registration.dispose()
    }
  })

  test('rejects cancelled calls and excessive results', async () => {
    const context = host()
    const registration = registerWebMCPTools(
      context,
      () => ({
        execute: async () => 'x'.repeat(300_000)
      }),
      'edit'
    )
    await registration.ready
    try {
      const tool = requiredTool(context.tools, 'get_node')
      const cancelled = new AbortController()
      cancelled.abort()
      await expect(tool.execute({ id: 'node' }, { signal: cancelled.signal })).rejects.toThrow()
      await expect(tool.execute({ id: 'node' }, options())).rejects.toThrow('Result too large')
    } finally {
      registration.dispose()
    }
  })

  test('reports committed edits even when their result exceeds the size limit', async () => {
    const context = host()
    let content = ''
    const registration = registerWebMCPTools(
      context,
      () => ({
        execute: async (_def, args) => {
          content = String(args.text)
          return { id: args.id, text: content }
        }
      }),
      'edit'
    )
    await registration.ready
    try {
      const text = 'x'.repeat(300_000)
      const result = await requiredTool(context.tools, 'set_text').execute(
        { id: 'node', text },
        options()
      )
      expect(content).toBe(text)
      expect(result).toBe(
        JSON.stringify({
          ok: true,
          resultOmitted: true,
          message: 'Edit committed. Result exceeds the size limit; inspect a smaller selection.'
        })
      )
    } finally {
      registration.dispose()
    }
  })

  test('cleans partial registration after browser rejection', async () => {
    const context = host()
    const registration = registerWebMCPTools(
      {
        async registerTool(
          tool: WebMCP.ModelContextTool,
          options?: WebMCP.ModelContextRegisterToolOptions
        ) {
          if (context.tools.size === 2) throw new Error('Registration denied')
          await context.registerTool(tool, options)
        }
      },
      () => ({ execute: async () => ({}) }),
      'edit'
    )
    await expect(registration.ready).rejects.toThrow('Registration denied')
    expect(context.tools.size).toBe(0)
  })
})
