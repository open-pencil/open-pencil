import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import {
  parseFigFile,
  computeAllLayouts,
  exportFigFile,
  importNodeChanges,
  initCodec,
  SceneGraph,
  FigmaAPI,
  type SceneNode,
  type Fill,
  type Color
} from '@open-pencil/core'

import { computeContentBounds } from '#core/io/formats/raster/render'

import { expectDefined } from '#tests/helpers/assert'
import {
  FIXTURES,
  parseFixture,
  parseGoldPreviewFixture,
  VALID_NODE_TYPES
} from '#tests/helpers/fig-fixtures'
import {
  childMatching,
  childNamed,
  collectAllNodes,
  countByType,
  previewChild
} from '#tests/helpers/fig-traversal'
import { heavy } from '#tests/helpers/test-utils'

setDefaultTimeout(60_000)

describe('variable roundtrip', () => {
  test('variables and collections survive export → re-import', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const col = graph.createCollection('Design Tokens')
    graph.createVariable('color/primary', 'COLOR', col.id, { r: 0.23, g: 0.51, b: 0.96, a: 1 })
    graph.createVariable('spacing/base', 'FLOAT', col.id, 8)
    graph.createVariable('visible', 'BOOLEAN', col.id, true)
    graph.createVariable('label', 'STRING', col.id, 'Hello')

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    expect(reimported.variables.size).toBe(4)
    expect(reimported.variableCollections.size).toBe(1)

    const reimportedCol = [...reimported.variableCollections.values()][0]
    expect(reimportedCol.name).toBe('Design Tokens')
    expect(reimportedCol.variableIds).toHaveLength(4)

    const vars = [...reimported.variables.values()]
    const colorVar = vars.find((v) => v.name === 'color/primary')
    expect(colorVar).toBeDefined()
    expect(expectDefined(colorVar, 'colorVar').type).toBe('COLOR')
    const colorVal = Object.values(colorVar.valuesByMode)[0] as Color
    expect(colorVal.r).toBeCloseTo(0.23, 1)

    const floatVar = vars.find((v) => v.name === 'spacing/base')
    expect(floatVar).toBeDefined()
    expect(expectDefined(floatVar, 'floatVar').type).toBe('FLOAT')
    expect(Object.values(floatVar.valuesByMode)[0]).toBe(8)

    const boolVar = vars.find((v) => v.name === 'visible')
    expect(boolVar).toBeDefined()
    expect(expectDefined(boolVar, 'boolVar').type).toBe('BOOLEAN')
    expect(Object.values(boolVar.valuesByMode)[0]).toBe(true)

    const strVar = vars.find((v) => v.name === 'label')
    expect(strVar).toBeDefined()
    expect(expectDefined(strVar, 'strVar').type).toBe('STRING')
    expect(Object.values(strVar.valuesByMode)[0]).toBe('Hello')
  })

  test('variable bindings survive export → re-import', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const col = graph.createCollection('Tokens')
    const floatVar = graph.createVariable('radius', 'FLOAT', col.id, 12)

    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Bound Rect',
      width: 100,
      height: 100,
      cornerRadius: 12
    })
    graph.bindVariable(rect.id, 'cornerRadius', floatVar.id)

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const reimportedRect = [...reimported.getAllNodes()].find((n) => n.name === 'Bound Rect')
    expect(reimportedRect).toBeDefined()
    expect(Object.keys(reimportedRect.boundVariables)).toContain('cornerRadius')
  })

  test('material3.fig variables survive round-trip', async () => {
    const original = await parseFixture('material3.fig')

    const exported = await exportFigFile(original)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    expect(reimported.variables.size).toBe(original.variables.size)
    expect(reimported.variableCollections.size).toBeGreaterThanOrEqual(
      [...original.variableCollections.values()].filter((c) => c.variableIds.length > 0).length
    )
  }, 120_000)

  test('pluginID casing is consistent across full codec pipeline', async () => {
    await initCodec()

    // Create a graph with multiple nodes having pluginData entries
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()
    frame.name = 'PluginID Test'
    frame.setPluginData('key1', 'value1')
    frame.setPluginData('key2', 'value2')

    const rect = api.createRectangle()
    rect.name = 'Plugin Rect'
    rect.setPluginData('testKey', 'testValue')

    // Round-trip through the codec
    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    // Find all nodes with pluginData
    let nodesWithPluginData = 0
    let totalEntries = 0
    for (const node of reimported.getAllNodes()) {
      if (node.pluginData && node.pluginData.length > 0) {
        nodesWithPluginData++
        for (const entry of node.pluginData) {
          totalEntries++
          // Every entry MUST use pluginId (lowercase d, matching SceneGraph type)
          expect(entry).toHaveProperty('pluginId')
          expect(typeof entry.pluginId).toBe('string')
          expect(entry.pluginId.length).toBeGreaterThan(0)
        }
      }
      // Also check pluginRelaunchData entries
      if (node.pluginRelaunchData && node.pluginRelaunchData.length > 0) {
        for (const entry of node.pluginRelaunchData) {
          expect(entry).toHaveProperty('pluginId')
          expect(typeof entry.pluginId).toBe('string')
        }
      }
    }

    // Should have at least 2 nodes with plugin data (frame + rect)
    expect(nodesWithPluginData).toBeGreaterThanOrEqual(2)
    expect(totalEntries).toBeGreaterThanOrEqual(3)
  })
})
