import { expect, test } from 'bun:test'

import { toolModelMessageSchema } from 'ai'

import { FigmaAPI } from '@lawha/core/figma-api'
import { SceneGraph } from '@lawha/scene-graph'

import { evalCode } from '#core/tools/analyze/eval'

function run(code: string) {
  return evalCode.execute(new FigmaAPI(new SceneGraph()), { code })
}

test('returns what a script returns as the JSON it prints as', async () => {
  const result = await run(
    'return { page: figma.createPage(), width: NaN, list: [1, undefined], byId: new Map([["a", 1]]) }'
  )

  expect(result).toMatchObject({ width: null, list: [1, null], byId: {} })
  expect(result).toHaveProperty('page.type', 'CANVAS')
})

test('a script result makes a tool message the AI SDK accepts in the next prompt', async () => {
  // The AI adapter sends results other than images to the model as JSON.
  const output = await run('return figma.root.children')
  const message = {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call',
        toolName: 'eval',
        output: { type: 'json', value: output }
      }
    ]
  }
  expect(toolModelMessageSchema.safeParse(message).success).toBe(true)
})

test('reports a script with no result, keeps a null one, and describes a function', async () => {
  expect(await run('const x = 1')).toEqual({ ok: true, message: 'Code executed (no return value)' })
  expect(await run('return figma.getNodeById("missing")')).toBeNull()
  expect(await run('return () => 1')).toBe('() => 1')
})
