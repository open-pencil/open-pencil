import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { defineTool, toolsToAI } from '@open-pencil/core/tools'
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
  test('sends any image result as media with its metadata as text', () => {
    const output = { mimeType: 'image/png', base64: 'AAAA', changedPixels: 12 }
    expect(adapt(output).toModelOutput({ output })).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: '{"changedPixels":12}' },
        { type: 'media', mediaType: 'image/png', data: 'AAAA' }
      ]
    })
  })

  test('keeps non-image results as JSON', () => {
    const output = { mimeType: 'application/pdf', base64: 'AAAA' }
    expect(adapt(output).toModelOutput({ output })).toEqual({ type: 'json', value: output })
  })
})
