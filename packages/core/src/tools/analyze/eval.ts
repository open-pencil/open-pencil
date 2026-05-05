import { defineTool } from '#core/tools/schema'

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Execute JavaScript with full Figma Plugin API access. Use for operations not covered by other tools. The `figma` global is available.',
  params: {
    code: { type: 'string', description: 'JavaScript code to execute', required: true }
  },
  mutates: true,
  execute: async (figma, { code }) => {
    type AsyncFunctionConstructor = new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>
    const AsyncFunction = Object.getPrototypeOf(async () => undefined)
      .constructor as AsyncFunctionConstructor
    const wrapped = code.trim().startsWith('return') ? code : `return (async () => { ${code} })()`
    const fn = new AsyncFunction('figma', wrapped)
    const result = await fn(figma)
    if (result && typeof result === 'object') {
      const toJSON = Reflect.get(result, 'toJSON')
      if (typeof toJSON === 'function') return toJSON.call(result)
    }
    if (result !== undefined && result !== null) return result
    return { ok: true, message: 'Code executed (no return value)' }
  }
})
