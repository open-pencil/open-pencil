import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, FigmaAPI, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

describe('set_image_fill tool', () => {
  const tool = expectDefined(
    ALL_TOOLS.find((t) => t.name === 'set_image_fill'),
    'set_image_fill tool'
  )

  test('sets an IMAGE fill with correct imageHash and scaleMode', () => {
    const { figma } = setup()
    const shape = expectDefined(
      ALL_TOOLS.find((t) => t.name === 'create_shape'),
      'create_shape tool'
    )
    const node = shape.execute(figma, {
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    }) as { id: string }

    const b64 = PNG_MAGIC.toBase64()
    const result = tool.execute(figma, { id: node.id, image_data: b64 }) as {
      id: string
      imageHash: string
      scaleMode: string
    }

    expect(result.imageHash).toBeTruthy()
    expect(result.scaleMode).toBe('FILL')

    const fills = expectDefined(figma.getNodeById(node.id), 'image-filled node').fills as Array<{
      type: string
      imageHash: string
      imageScaleMode: string
    }>
    expect(fills).toHaveLength(1)
    expect(fills[0].type).toBe('IMAGE')
    expect(fills[0].imageHash).toBe(result.imageHash)
    expect(fills[0].imageScaleMode).toBe('FILL')
  })

  test('returns error for non-existent node', () => {
    const { figma } = setup()
    const result = tool.execute(figma, { id: 'nonexistent', image_data: PNG_MAGIC.toBase64() }) as {
      error: string
    }
    expect(result.error).toContain('not found')
  })

  test('default scale mode is FILL', () => {
    const { figma } = setup()
    const shape = expectDefined(
      ALL_TOOLS.find((t) => t.name === 'create_shape'),
      'create_shape tool'
    )
    const node = shape.execute(figma, { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }) as {
      id: string
    }

    const result = tool.execute(figma, { id: node.id, image_data: PNG_MAGIC.toBase64() }) as {
      scaleMode: string
    }
    expect(result.scaleMode).toBe('FILL')
  })

  test('all scale modes work', () => {
    const modes = ['FILL', 'FIT', 'CROP', 'TILE'] as const
    for (const mode of modes) {
      const { figma } = setup()
      const shape = expectDefined(
        ALL_TOOLS.find((t) => t.name === 'create_shape'),
        'create_shape tool'
      )
      const node = shape.execute(figma, {
        type: 'RECTANGLE',
        x: 0,
        y: 0,
        width: 50,
        height: 50
      }) as { id: string }

      const result = tool.execute(figma, {
        id: node.id,
        image_data: PNG_MAGIC.toBase64(),
        scale_mode: mode
      }) as { scaleMode: string }
      expect(result.scaleMode).toBe(mode)

      const fills = expectDefined(figma.getNodeById(node.id), 'image-filled node').fills as Array<{
        imageScaleMode: string
      }>
      expect(fills[0].imageScaleMode).toBe(mode)
    }
  })

  test('image data is stored in graph.images', () => {
    const { graph, figma } = setup()
    const shape = expectDefined(
      ALL_TOOLS.find((t) => t.name === 'create_shape'),
      'create_shape tool'
    )
    const node = shape.execute(figma, { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }) as {
      id: string
    }

    const result = tool.execute(figma, { id: node.id, image_data: PNG_MAGIC.toBase64() }) as {
      imageHash: string
    }
    expect(graph.images.get(result.imageHash)).toEqual(PNG_MAGIC)
  })
})

