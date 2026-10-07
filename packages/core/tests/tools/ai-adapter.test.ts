import { describe, expect, test } from 'bun:test'

import { toolModelMessageSchema } from 'ai'
import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { defineTool, toolsToAI, type ToolLogEntry } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

type ToolFactory = Parameters<typeof toolsToAI>[2]['tool']

// The adapter only forwards definitions to the factory; an identity factory exposes them.
const tool = ((definition: unknown) => definition) as ToolFactory

type ModelOutputTool = {
  toModelOutput(options: { output: unknown }): unknown
}

function adapt(output: unknown): ModelOutputTool {
  const def = defineTool({
    name: 'image_tool',
    description: 'Returns a fixed result',
    execution: { kind: 'sync', mutation: 'none' },
    input: v.object({}),
    execute: () => output
  })
  const figma = new FigmaAPI(new SceneGraph())
  const tools = toolsToAI([def], { getFigma: () => figma }, { tool })
  const adapted: unknown = tools.image_tool
  if (!hasModelOutput(adapted)) throw new Error('image_tool has no toModelOutput')
  return adapted
}

function hasModelOutput(value: unknown): value is ModelOutputTool {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toModelOutput' in value &&
    typeof value.toModelOutput === 'function'
  )
}

describe('AI adapter model output', () => {
  test('sends any image result as a file with its metadata as text', () => {
    const output = { mimeType: 'image/png', base64: 'AAAA', changedPixels: 12 }
    expect(adapt(output).toModelOutput({ output })).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: '{"changedPixels":12}' },
        { type: 'file', mediaType: 'image/png', data: { type: 'data', data: 'AAAA' } }
      ]
    })
  })

  test.each([
    { mimeType: 'image/png', base64: 'AAAA', changedPixels: 12 },
    { mimeType: 'image/png', base64: 'AAAA' },
    { mimeType: 'application/pdf', base64: 'AAAA' }
  ])('produces a tool message the AI SDK accepts in the next prompt (%p)', (output) => {
    const message = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call',
          toolName: 'image_tool',
          output: adapt(output).toModelOutput({ output })
        }
      ]
    }
    expect(toolModelMessageSchema.safeParse(message).success).toBe(true)
  })

  test('keeps non-image results as JSON', () => {
    const output = { mimeType: 'application/pdf', base64: 'AAAA' }
    expect(adapt(output).toModelOutput({ output })).toEqual({ type: 'json', value: output })
  })
})

type ExecutableTool = {
  execute(args: Record<string, unknown>, options: { toolCallId: string }): Promise<unknown>
}

function hasExecute(value: unknown): value is ExecutableTool {
  return (
    typeof value === 'object' &&
    value !== null &&
    'execute' in value &&
    typeof value.execute === 'function'
  )
}

async function runLogged(execute: () => unknown) {
  const def = defineTool({
    name: 'logged_tool',
    description: 'Runs the given body',
    execution: { kind: 'sync', mutation: 'none' },
    input: v.object({}),
    execute
  })
  const figma = new FigmaAPI(new SceneGraph())
  const entries: ToolLogEntry[] = []
  const tools = toolsToAI(
    [def],
    { getFigma: () => figma, onToolLog: (entry) => entries.push(entry) },
    { tool }
  )
  const adapted: unknown = tools.logged_tool
  if (!hasExecute(adapted)) throw new Error('logged_tool has no execute')
  const result = await adapted.execute({}, { toolCallId: 'call' })
  return { result, entries }
}

describe('AI adapter tool log', () => {
  test('gives the model the message and the log what was thrown', async () => {
    const thrown = new TypeError('stops.map is not a function')
    const { result, entries } = await runLogged(() => {
      throw thrown
    })
    expect(result).toEqual({ error: 'stops.map is not a function' })
    expect(entries).toMatchObject([{ error: 'stops.map is not a function', cause: thrown }])
  })

  test('logs a returned error as a failure, like a thrown one', async () => {
    const { entries } = await runLogged(() => ({
      id: '999:999',
      error: 'Node "999:999" not found'
    }))
    expect(entries).toMatchObject([{ error: 'Node "999:999" not found', cause: undefined }])
  })

  test('logs a result without an error as a success', async () => {
    const { entries } = await runLogged(() => ({ id: '1:2', name: 'Card' }))
    expect(entries[0]?.error).toBeUndefined()
  })
})
