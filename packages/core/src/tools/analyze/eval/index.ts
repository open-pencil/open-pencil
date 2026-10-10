import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

import { compileScript } from './wrap'

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Execute JavaScript with full Figma Plugin API access. Use for operations not covered by other tools. The `figma` global is the Figma Plugin API; the `openpencil` global adds what Figma has no API for, such as component behaviours (`openpencil.setBehaviour`, `openpencil.getBehaviour`, `openpencil.behaviourKinds`) and slots (`openpencil.createSlot`).',
  execution: { kind: 'async', mutation: 'document' },
  capabilities: ['document:read', 'document:write', 'code:execute'],
  availability: 'eval',
  input: v.strictObject({
    code: v.pipe(v.string(), v.description('JavaScript code to execute'))
  }),

  execute: async (figma, { code }) => {
    const result = await compileScript(code)(figma)
    if (result && typeof result === 'object') {
      const toJSON = Reflect.get(result, 'toJSON')
      if (typeof toJSON === 'function') return toJSON.call(result)
    }
    if (result !== undefined && result !== null) return result
    return { ok: true, message: 'Code executed (no return value)' }
  }
})
