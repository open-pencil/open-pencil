import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

import { compileScript } from './wrap'

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Execute JavaScript with full Figma Plugin API access. Use for operations not covered by other tools. The `figma` global is the Figma Plugin API; as in Figma, `await figma.loadFontAsync(fontName)` every font a text uses, and any new font, before editing its characters, size, font, or layout; the `openpencil` global adds what Figma has no API for, such as component behaviours (`openpencil.setBehaviour`, `openpencil.getBehaviour`, `openpencil.behaviourKinds`), slots (`openpencil.createSlot`), comments (`openpencil.getComments`, `openpencil.getComment`, `openpencil.addComment`, and each comment’s `reply` and `resolve`), statuses (`openpencil.statuses`, `openpencil.getStatus`, `openpencil.setStatus`), variable bindings as the layer panel makes them (`openpencil.bindVariable(node, field, variable)`, `openpencil.unbindVariable(node, field)`), layout and text direction (`openpencil.getLayoutDirection`, `setLayoutDirection`, `getTextDirection`, `setTextDirection`), OkHCL paint colors (`openpencil.getFillOkHCL`, `setFillOkHCL`, `getStrokeOkHCL`, `setStrokeOkHCL`), `openpencil.exposeInstanceSwap(instances, candidates, name)`, and `openpencil.getFontStatus()`.',
  execution: { kind: 'async', mutation: 'document' },
  capabilities: ['document:read', 'document:write', 'code:execute'],
  availability: 'eval',
  input: v.strictObject({
    code: v.pipe(v.string(), v.description('JavaScript code to execute'))
  }),

  execute: async (figma, { code }) => {
    const result: unknown = await compileScript(code)(figma)
    // `null` is a result, such as a lookup that found nothing; only nothing returned is not.
    if (result === undefined) return { ok: true, message: 'Code executed (no return value)' }
    // JSON has no text for these; their description is the closest.
    if (typeof result === 'function' || typeof result === 'symbol') return String(result)
    // Callers read a result as JSON: MCP and the CLI print it, and the AI chat's model takes
    // nothing else. So a script gets back what printing shows: nodes, even inside objects, as
    // their JSON, `NaN` as null, and a `Map` as `{}`.
    const json = JSON.stringify(result)
    return JSON.parse(json) as unknown
  }
})
