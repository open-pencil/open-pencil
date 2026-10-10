import { describe, expect, test } from 'bun:test'

import {
  createShaderPaint,
  isShaderFrameCurrent,
  OPEN_PENCIL_PLUGIN_DATA,
  pluginDataEntry,
  readShaderPaints,
  SceneGraph,
  shaderOfPaint,
  shaderPresetKey,
  withShaderPaints,
  type ShaderPreset
} from '@open-pencil/scene-graph'

const AURORA: ShaderPreset = {
  components: [{ type: 'Aurora', props: { colorA: '#7c3aed' } }]
}
const SWIRL: ShaderPreset = { components: [{ type: 'Swirl' }] }

function rectangle() {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: 100,
    height: 50
  })
  return { graph, node }
}

describe('shader paints', () => {
  test('an image paint draws the shader whose frame it shows', () => {
    const { graph, node } = rectangle()
    const { paint, shader } = createShaderPaint(AURORA)
    graph.updateNode(node.id, {
      fills: [paint],
      pluginData: withShaderPaints(node, [paint], [shader])
    })
    const stored = graph.getNode(node.id)
    if (!stored) throw new Error('missing node')

    expect(shaderOfPaint(stored, paint)?.preset).toEqual(AURORA)
    expect(shaderOfPaint(stored, { ...paint, imageHash: 'other' })).toBeNull()
  })

  test('keeps the entry with its paint when fills are reordered', () => {
    const { graph, node } = rectangle()
    const aurora = createShaderPaint(AURORA)
    const swirl = createShaderPaint(SWIRL)
    const fills = [aurora.paint, swirl.paint]
    graph.updateNode(node.id, {
      fills,
      pluginData: withShaderPaints(node, fills, [aurora.shader, swirl.shader])
    })
    const stored = graph.getNode(node.id)
    if (!stored) throw new Error('missing node')

    expect(shaderOfPaint(stored, swirl.paint)?.preset).toEqual(SWIRL)
    expect(shaderOfPaint(stored, aurora.paint)?.preset).toEqual(AURORA)
  })

  test('drops shaders no paint shows any more', () => {
    const { node } = rectangle()
    const aurora = createShaderPaint(AURORA)
    const swirl = createShaderPaint(SWIRL)
    const both = {
      ...node,
      pluginData: withShaderPaints(node, [aurora.paint, swirl.paint], [aurora.shader, swirl.shader])
    }

    const kept = withShaderPaints(both, [swirl.paint])

    expect(readShaderPaints({ pluginData: kept }).map((shader) => shader.preset)).toEqual([SWIRL])
  })

  test('ignores an entry that is not a shader', () => {
    const entry = pluginDataEntry(OPEN_PENCIL_PLUGIN_DATA.shader, {
      image: 'abc',
      preset: AURORA
    })

    expect(
      readShaderPaints({
        pluginData: [{ ...entry, value: '{"image":"abc","preset":{"components":[]}}' }]
      })
    ).toEqual([])
    expect(readShaderPaints({ pluginData: [entry] })).toHaveLength(1)
  })

  test('a frame drawn for another preset is not current', () => {
    const { shader } = createShaderPaint(SWIRL)
    const drawnForAurora = {
      ...shader,
      frame: { width: 100, height: 50, preset: shaderPresetKey(AURORA) }
    }

    expect(isShaderFrameCurrent(drawnForAurora, { width: 100, height: 50 })).toBe(false)
  })

  test('a frame is current for the size it was rendered at', () => {
    const { shader } = createShaderPaint(AURORA)

    expect(isShaderFrameCurrent(shader, { width: 100, height: 50 })).toBe(false)
    const rendered = {
      ...shader,
      frame: { width: 100, height: 50, preset: shaderPresetKey(AURORA) }
    }
    expect(isShaderFrameCurrent(rendered, { width: 100.2, height: 50 })).toBe(true)
    expect(isShaderFrameCurrent(rendered, { width: 120, height: 50 })).toBe(false)
  })
})
