import { describe, expect, test } from 'bun:test'

import {
  contentPluginData,
  OPEN_PENCIL_PLUGIN_DATA,
  OPEN_PENCIL_PLUGIN_ID,
  readAllPluginData,
  readPluginData,
  SceneGraph,
  withPluginData,
  type PluginDataEntry
} from '@open-pencil/scene-graph'
import {
  clearNodeFillOkHCL,
  getNodeOkHCLPayloads,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '@open-pencil/scene-graph/color'

const { exportSettings, okhcl, textDirection } = OPEN_PENCIL_PLUGIN_DATA
const OTHER_PLUGIN: PluginDataEntry = { pluginId: 'other-plugin', key: 'okhcl', value: 'theirs' }

function entry(key: string, value: string): PluginDataEntry {
  return { pluginId: OPEN_PENCIL_PLUGIN_ID, key, value }
}

describe('OpenPencil plugin data', () => {
  test('keeps content and other plugins’ entries as a node’s content', () => {
    const entries = [
      OTHER_PLUGIN,
      entry('textDirection', 'RTL'),
      entry('librarySource', '{}'),
      entry('okhcl', '[]')
    ]
    expect(contentPluginData(entries)).toEqual([entry('okhcl', '[]'), OTHER_PLUGIN])
  })

  test('gives every field its own key', () => {
    const keys = Object.values(OPEN_PENCIL_PLUGIN_DATA).map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('reads a value that is not JSON or has the wrong shape as missing', () => {
    for (const value of ['{not json', '{"scale":2}', '[{"scale":2,"format":"gif"}]']) {
      expect(readPluginData([entry('exportSettings', value)], exportSettings)).toBeUndefined()
    }
    expect(readPluginData([entry('textDirection', 'SIDEWAYS')], textDirection)).toBeUndefined()
    expect(readPluginData([entry('textDirection', 'RTL')], textDirection)).toBe('RTL')
  })

  test('ignores the same key written by another plugin', () => {
    const entries = [{ ...entry('textDirection', 'RTL'), pluginId: 'other-plugin' }]
    expect(readPluginData(entries, textDirection)).toBeUndefined()
  })

  test('replaces its own entry and keeps everything else', () => {
    const settings = [{ scale: 2, format: 'png' as const }]
    const entries = withPluginData(
      [entry('exportSettings', '[]'), OTHER_PLUGIN, entry('textDirection', 'LTR')],
      exportSettings,
      settings
    )
    expect(entries).toEqual([
      OTHER_PLUGIN,
      entry('textDirection', 'LTR'),
      entry('exportSettings', JSON.stringify(settings))
    ])
    expect(readPluginData(entries, exportSettings)).toEqual(settings)
    expect(withPluginData(entries, exportSettings, undefined)).toEqual(entries.slice(0, 2))
  })

  test('picking an OkHCL color keeps the node’s other plugin data', () => {
    const graph = new SceneGraph()
    const paint = { type: 'SOLID' as const, visible: true, opacity: 1, color: { r: 1, g: 0, b: 0, a: 1 } }
    const node = graph.createNode('FRAME', graph.getPages()[0].id, {
      fills: [paint],
      strokes: [{ ...paint, weight: 1, align: 'INSIDE' as const }],
      pluginData: [OTHER_PLUGIN, entry('exportSettings', '[{"scale":1,"format":"png"}]')]
    })
    const color = { h: 30, c: 0.1, l: 0.6, a: 1 }

    graph.updateNode(node.id, setNodeFillOkHCL(node, 0, color))
    graph.updateNode(node.id, setNodeStrokeOkHCL(node, 0, color))
    graph.updateNode(node.id, clearNodeFillOkHCL(node, 0))

    const pluginData = graph.getNode(node.id)?.pluginData ?? []
    expect(pluginData.slice(0, 2)).toEqual([
      OTHER_PLUGIN,
      entry('exportSettings', '[{"scale":1,"format":"png"}]')
    ])
    expect(readAllPluginData(pluginData, okhcl).map(({ kind }) => kind)).toEqual(['stroke'])
    expect(getNodeOkHCLPayloads({ ...node, pluginData })).toHaveLength(1)
  })
})
