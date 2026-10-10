import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  createShaderPaint,
  SceneGraph,
  shaderOfPaint,
  shaderPresetKey,
  withShaderPaints,
  type ShaderPreset
} from '@open-pencil/scene-graph'

const AURORA: ShaderPreset = { components: [{ type: 'Aurora' }] }
const SWIRL: ShaderPreset = { components: [{ type: 'Swirl' }] }

function setup() {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: 40,
    height: 20,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  const editor = createEditor({ graph })
  const drawn: { preset: ShaderPreset; width: number; height: number }[] = []
  editor.setShaderRasterizer({
    render: (preset, size) => {
      drawn.push({ preset, ...size })
      return Promise.resolve(new Uint8Array([drawn.length]))
    }
  })
  const read = () => {
    const current = editor.graph.getNode(node.id)
    if (!current) throw new Error('missing node')
    return current
  }
  return { editor, id: node.id, drawn, read }
}

describe('shader paints', () => {
  test('a fill becomes a shader as one undo step', () => {
    const { editor, id, read } = setup()
    const before = read().fills

    editor.setShaderPaint([id], 'fills', 0, AURORA)
    const [paint] = read().fills
    expect(paint.type).toBe('IMAGE')
    expect(shaderOfPaint(read(), paint)?.preset).toEqual(AURORA)

    editor.undoAction()
    expect(read().fills).toEqual(before)
    expect(shaderOfPaint(read(), paint)).toBeNull()
  })

  test('changing the preset keeps the paint’s image', () => {
    const { editor, id, read } = setup()
    editor.setShaderPaint([id], 'fills', 0, AURORA)
    const image = read().fills[0].imageHash

    editor.setShaderPaint([id], 'fills', 0, SWIRL)

    expect(read().fills[0].imageHash).toBe(image)
    expect(shaderOfPaint(read(), read().fills[0])?.preset).toEqual(SWIRL)
  })

  test('draws the frame at twice the layer’s size under the paint’s image', async () => {
    const { editor, id, drawn, read } = setup()
    editor.setShaderPaint([id], 'fills', 0, AURORA)
    await editor.settleShaderFrames()

    const [paint] = read().fills
    expect(drawn).toEqual([{ preset: AURORA, width: 80, height: 40 }])
    expect(editor.graph.images.get(paint.imageHash ?? '')).toEqual(new Uint8Array([1]))
    expect(shaderOfPaint(read(), paint)?.frame).toEqual({
      width: 40,
      height: 20,
      preset: shaderPresetKey(AURORA)
    })

    await editor.settleShaderFrames()
    expect(drawn).toHaveLength(1)
  })

  test('draws again after a resize and after undoing a preset change', async () => {
    const { editor, id, drawn } = setup()
    editor.setShaderPaint([id], 'fills', 0, AURORA)
    await editor.settleShaderFrames()

    editor.updateNodeWithUndo(id, { width: 60 })
    await editor.settleShaderFrames()
    editor.setShaderPaint([id], 'fills', 0, SWIRL)
    await editor.settleShaderFrames()
    editor.undoAction()
    await editor.settleShaderFrames()

    expect(drawn.map(({ preset, width }) => [preset, width])).toEqual([
      [AURORA, 80],
      [AURORA, 120],
      [SWIRL, 120],
      [AURORA, 120]
    ])
  })

  test('sets a shader on several layers as one undo step, each with its own image', () => {
    const { editor, id, read } = setup()
    const other = editor.graph.createNode('RECTANGLE', editor.graph.getPages()[0].id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    editor.setShaderPaint([id, other.id], 'fills', 0, AURORA)
    const images = [read().fills[0].imageHash, editor.graph.getNode(other.id)?.fills[0].imageHash]
    expect(new Set(images).size).toBe(2)

    editor.undoAction()
    expect(read().fills[0].type).toBe('SOLID')
    expect(editor.graph.getNode(other.id)?.fills[0].type).toBe('SOLID')
  })

  test('a stroke keeps its weight when it becomes a shader', () => {
    const { editor, id, read } = setup()
    editor.updateNodeWithUndo(id, {
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          weight: 3,
          align: 'CENTER'
        }
      ]
    })

    editor.setShaderPaint([id], 'strokes', 0, AURORA)

    expect(read().strokes[0]).toMatchObject({ type: 'IMAGE', weight: 3, align: 'CENTER' })
  })
})

describe('shader frames on page preparation', () => {
  test('a page is prepared only once its shaders have frames, without drawing in the background', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, { width: 40, height: 20 })
    const { paint, shader } = createShaderPaint(AURORA)
    graph.updateNode(node.id, {
      fills: [paint],
      pluginData: withShaderPaints(node, [paint], [shader])
    })
    const drawn: string[] = []
    const editor = createEditor({
      shaderRasterizer: {
        render: (preset) => {
          drawn.push(preset.components[0]?.type ?? '')
          return Promise.resolve(new Uint8Array([1]))
        }
      }
    })
    editor.replaceGraph(graph)
    await editor.settleShaderFrames()
    expect(drawn).toEqual([])

    const phases: string[] = []
    await editor.preparePage(page.id, { onProgress: (progress) => phases.push(progress.phase) })

    expect(drawn).toEqual(['Aurora'])
    expect(phases).toContain('drawing-shaders')
    expect(editor.graph.images.get(shader.image)).toEqual(new Uint8Array([1]))
  })
})
