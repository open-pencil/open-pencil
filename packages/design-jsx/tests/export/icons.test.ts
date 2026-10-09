import { describe, expect, test } from 'bun:test'

import { sceneNodeToJSX } from '#design-jsx/export/index'

import { iconGlyph, SceneGraph, withIcon, withIconTint } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** An icon frame as placing one leaves it: its name on the frame, its tinted path inside. */
function iconFrame(color: Color, name?: string) {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    name: name ?? 'home',
    width: 20,
    height: 20
  })
  graph.updateNode(frame.id, { pluginData: withIcon(frame, { name: 'lucide:home' }) })
  const path = graph.createNode('VECTOR', frame.id, {
    name: 'path',
    width: 20,
    height: 20,
    fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
  })
  graph.updateNode(path.id, { pluginData: withIconTint(path, ['fill']) })
  return { graph, frame }
}

describe('icons in design JSX export', () => {
  test('write the icon by name, with its size and color, not its paths', () => {
    const { graph, frame } = iconFrame({ r: 79 / 255, g: 70 / 255, b: 229 / 255, a: 1 })
    expect(sceneNodeToJSX(frame.id, graph)).toBe(
      '<Icon name="lucide:home" size={20} color="#4F46E5" />'
    )
  })

  test('leave out black, the default color, and keep a layer name someone gave it', () => {
    const { graph, frame } = iconFrame({ r: 0, g: 0, b: 0, a: 1 }, 'Home')
    expect(sceneNodeToJSX(frame.id, graph)).toBe(
      '<Icon name="lucide:home" size={20} label="Home" />'
    )
  })

  test('write an icon whose paths were edited as the paths it draws', () => {
    const { graph, frame } = iconFrame({ r: 0, g: 0, b: 0, a: 1 })
    const node = graph.getNode(frame.id) ?? frame
    graph.updateNode(frame.id, {
      pluginData: withIcon(node, { name: 'lucide:home', glyph: iconGlyph(graph, node) })
    })
    graph.createNode('RECTANGLE', frame.id, { name: 'Badge', width: 4, height: 4 })
    const jsx = sceneNodeToJSX(frame.id, graph)
    expect(jsx).not.toContain('<Icon')
    // Both the icon's path and the added badge are written out.
    expect(jsx).toContain('name="path"')
    expect(jsx).toContain('name="Badge"')
  })

  test('leave out the name an icon was placed with, in the old style too', () => {
    const { graph, frame } = iconFrame({ r: 0, g: 0, b: 0, a: 1 }, 'Icon / lucide:home')
    expect(sceneNodeToJSX(frame.id, graph)).toBe('<Icon name="lucide:home" size={20} />')
  })
})
