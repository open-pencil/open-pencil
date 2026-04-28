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
    // eslint-disable-next-line no-empty-function
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const wrapped = code.trim().startsWith('return') ? code : `return (async () => { ${code} })()`
    const fn = new AsyncFunction('figma', wrapped)
    const result = await fn(figma)
    if (result && typeof result === 'object' && 'toJSON' in result) return result.toJSON()
    if (result !== undefined && result !== null) return result
    return { ok: true, message: 'Code executed (no return value)' }
  }
})
