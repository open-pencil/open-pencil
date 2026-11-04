import { describe, expect, test } from 'bun:test'

import { toolModelMessageSchema } from 'ai'
import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  defineTool,
  toolsToAI,
  type AIAdapterOptions,
  type ToolLogEntry
} from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

type ToolFactory = Parameters<typeof toolsToAI>[2]['tool']

// The adapter only forwards definitions to the factory; an identity factory exposes them.
const tool = ((definition: unknown) => definition) as ToolFactory

type ModelOutputTool = {
  toModelOutput(options: { toolCallId: string; output: unknown }): Promise<unknown>
}

function adapt(
  output: unknown,
  encodeModelImage?: AIAdapterOptions['encodeModelImage']
): ModelOutputTool {
  const def = defineTool({
    name: 'image_tool',
    description: 'Returns a fixed result',
    execution: { kind: 'sync', mutation: 'none' },
    input: v.strictObject({}),
    execute: () => output
  })
  const figma = new FigmaAPI(new SceneGraph())
  const tools = toolsToAI([def], { getFigma: () => figma, encodeModelImage }, { tool })
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
  test('sends any image result as a file with its metadata as text', async () => {
    const output = { mimeType: 'image/png', base64: 'AAAA', changedPixels: 12 }
    expect(await adapt(output).toModelOutput({ toolCallId: 'call', output })).toEqual({
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
  ])('produces a tool message the AI SDK accepts in the next prompt (%p)', async (output) => {
    const message = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call',
          toolName: 'image_tool',
          output: await adapt(output).toModelOutput({ toolCallId: 'call', output })
        }
      ]
    }
    expect(toolModelMessageSchema.safeParse(message).success).toBe(true)
  })

  test('keeps non-image results as JSON', async () => {
    const output = { mimeType: 'application/pdf', base64: 'AAAA' }
    expect(await adapt(output).toModelOutput({ toolCallId: 'call', output })).toEqual({
      type: 'json',
      value: output
    })
  })

  test('sends the image the connection encodes, once per tool call', async () => {
    const output = { mimeType: 'image/png', base64: 'AAAA' }
    const encoded: string[] = []
    const adapted = adapt(output, async (image) => {
      encoded.push(image.data)
      return { data: 'BBBB', mediaType: 'image/webp' }
    })
    const file = {
      type: 'file',
      mediaType: 'image/webp',
      data: { type: 'data', data: 'BBBB' }
    }
    expect(await adapted.toModelOutput({ toolCallId: 'call', output })).toEqual({
      type: 'content',
      value: [file]
    })
    // Every request sends the conversation again; its images are not encoded again.
    await adapted.toModelOutput({ toolCallId: 'call', output })
    await adapted.toModelOutput({ toolCallId: 'other', output })
    expect(encoded).toEqual(['AAAA', 'AAAA'])
  })

  test('sends the tool image when encoding it fails', async () => {
    const output = { mimeType: 'image/png', base64: 'AAAA' }
    const adapted = adapt(output, () => Promise.reject(new Error('no encoder')))
    expect(await adapted.toModelOutput({ toolCallId: 'call', output })).toEqual({
      type: 'content',
      value: [{ type: 'file', mediaType: 'image/png', data: { type: 'data', data: 'AAAA' } }]
    })
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
    input: v.strictObject({}),
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
