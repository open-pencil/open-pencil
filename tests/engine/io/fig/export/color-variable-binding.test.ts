import { beforeAll, describe, expect, test } from 'bun:test'

import { inflateSync, unzipSync } from 'fflate'

import { exportFigFile, initCodec, SceneGraph, type GUID } from '@open-pencil/core'
import { ByteBuffer, compileSchema, decodeBinarySchema } from '@open-pencil/kiwi'
import { parseFigKiwiContainer } from '@open-pencil/kiwi/fig/parse'

import { expectDefined } from '#tests/helpers/assert'

interface DecodedPaint {
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
}

function decodeNodeChanges(fig: Uint8Array): DecodedNodeChange[] {
  const canvas = expectDefined(unzipSync(fig)['canvas.fig'], 'canvas.fig')
  const container = expectDefined(parseFigKiwiContainer(canvas), 'kiwi container')
  const schema = decodeBinarySchema(new ByteBuffer(inflateSync(container.schemaDeflated)))
  const message = compileSchema(schema).decodeMessage(container.dataRaw) as {
    nodeChanges: DecodedNodeChange[]
  }
  return message.nodeChanges
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
})
