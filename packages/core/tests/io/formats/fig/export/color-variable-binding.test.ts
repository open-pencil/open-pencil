import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { inflateSync, unzipSync } from 'fflate'

import { exportFigFile, initCodec, SceneGraph } from '@open-pencil/core'
import { parseFigKiwiContainer } from '@open-pencil/kiwi/fig/parse'
import { ByteBuffer, compileSchema, decodeBinarySchema } from '@open-pencil/kiwi/schema-runtime'
import type { Color, GUID } from '@open-pencil/scene-graph/primitives'

interface DecodedPaint {
  color?: Color
  opacity?: number
  colorVar?: {
    value?: { alias?: { guid?: GUID } }
    dataType?: string
    resolvedDataType?: string
  }
}

interface DecodedNodeChange {
  name?: string
  guid?: GUID
  type?: string
  fillPaints?: DecodedPaint[]
  strokePaints?: DecodedPaint[]
  cornerRadius?: number
}

function decodeNodeChanges(fig: Uint8Array): DecodedNodeChange[] {
  const canvas = expectDefined(unzipSync(fig)['canvas.fig'], 'canvas.fig')
  const container = expectDefined(parseFigKiwiContainer(canvas), 'kiwi container')
  const schema = decodeBinarySchema(new ByteBuffer(inflateSync(container.schemaDeflated)))
  const decode = expectDefined(compileSchema(schema).decodeMessage, 'decodeMessage')
  const nodeChanges = decode(container.dataRaw).nodeChanges
  if (!Array.isArray(nodeChanges)) throw new Error('decoded message has no nodeChanges')
  return nodeChanges as DecodedNodeChange[]
}

beforeAll(async () => {
  await initCodec()
})

describe('Figma export colour variable bindings', () => {
  test('writes a bound fill or stroke colour as colorVar', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const brand = graph.createVariable('brand', 'COLOR', graph.createCollection('Tokens').id, {
      r: 0.2,
      g: 0.4,
      b: 0.9,
      a: 1
    })
    const color = { r: 0.2, g: 0.4, b: 0.9, a: 1 }
    graph.createNode('RECTANGLE', page.id, {
      name: 'Bound',
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color, opacity: 1, visible: true }],
      strokes: [
        {
          type: 'SOLID',
          color,
          weight: 1,
          opacity: 1,
          visible: true,
          align: 'CENTER',
          cap: 'NONE',
          join: 'MITER'
        }
      ]
    })
    const rect = expectDefined(
      graph.getChildren(page.id).find((node) => node.name === 'Bound'),
      'rectangle'
    )
    rect.boundVariables = { 'fills/0/color': brand.id, 'strokes/0/color': brand.id }

    const exported = await exportFigFile(graph)
    const nodeChanges = decodeNodeChanges(new Uint8Array(exported))
    const variable = expectDefined(
      nodeChanges.find((change) => change.type === 'VARIABLE'),
      'exported variable'
    )
    const bound = expectDefined(
      nodeChanges.find((change) => change.name === 'Bound'),
      'bound rectangle'
    )

    for (const exportedPaint of [bound.fillPaints?.[0], bound.strokePaints?.[0]]) {
      expect(exportedPaint?.colorVar).toEqual({
        value: { alias: { guid: variable.guid } },
        dataType: 'ALIAS',
        resolvedDataType: 'COLOR'
      })
    }
  })

  test("writes bound fields resolved for each node's mode, as Figma draws the stored value", async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const theme = graph.createCollection('Theme')
    const light = theme.defaultModeId
    graph.addMode(theme.id, 'dark', 'Dark')
    const surface = graph.createVariable('Surface', 'COLOR', theme.id, { r: 1, g: 1, b: 1, a: 1 })
    surface.valuesByMode.dark = { r: 0.07, g: 0.09, b: 0.15, a: 0.8 }
    const radius = graph.createVariable('Radius', 'FLOAT', theme.id, 12)
    radius.valuesByMode.dark = 16
    graph.setDefaultMode(theme.id, 'dark')
    // Stale literals, as a graph bound without the editor keeps them.
    const stale = { r: 1, g: 0, b: 0, a: 1 }
    const card = (name: string, variableModes: Record<string, string> = {}) => {
      const node = graph.createNode('FRAME', page.id, {
        name,
        width: 40,
        height: 40,
        cornerRadius: 0,
        variableModes,
        fills: [{ type: 'SOLID', color: stale, opacity: 1, visible: true }]
      })
      graph.bindVariable(node.id, 'fills/0/color', surface.id)
      graph.bindVariable(node.id, 'cornerRadius', radius.id)
      return node
    }
    const dark = card('Default mode')
    card('Light mode', { [theme.id]: light })

    const nodeChanges = decodeNodeChanges(new Uint8Array(await exportFigFile(graph)))
    const exported = (name: string) =>
      expectDefined(
        nodeChanges.find((change) => change.name === name),
        name
      )

    const defaultCard = exported('Default mode')
    expect(defaultCard.cornerRadius).toBe(16)
    expect(defaultCard.fillPaints?.[0]?.color).toEqual({
      r: expect.closeTo(0.07, 5),
      g: expect.closeTo(0.09, 5),
      b: expect.closeTo(0.15, 5),
      a: 1
    })
    expect(defaultCard.fillPaints?.[0]?.opacity).toBeCloseTo(0.8, 5)
    const lightCard = exported('Light mode')
    expect(lightCard.cornerRadius).toBe(12)
    expect(lightCard.fillPaints?.[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    expect(lightCard.fillPaints?.[0]?.opacity).toBe(1)
    // Export reads the document; it does not resolve bindings into it.
    expect(graph.getNode(dark.id)?.fills[0]?.color).toEqual(stale)
    expect(graph.getNode(dark.id)?.cornerRadius).toBe(0)
  })
})
