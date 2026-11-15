import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

import { compileScript } from './wrap'

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Run JavaScript with the Figma Plugin API as `figma`, for what other tools do not cover. As in Figma, `await figma.loadFontAsync(fontName)` for every font a text uses, and any new one, before editing its text, size, font, or layout. ' +
    'The `openpencil` global adds what Figma lacks: setBehaviour, getBehaviour, behaviourKinds, createSlot, getComments, getComment, addComment (comments have reply and resolve), statuses, getStatus, setStatus, bindVariable(node, field, variable), unbindVariable(node, field), get/setLayoutDirection, get/setTextDirection, get/setFillOkHCL, get/setStrokeOkHCL, exposeInstanceSwap(instances, candidates, name), and getFontStatus().',
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
