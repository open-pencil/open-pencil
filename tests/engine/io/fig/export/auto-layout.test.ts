import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'

function decodeExport(bytes: Uint8Array) {
  return parseFigBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

describe('.fig auto-layout export', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('translates inherited counter-axis stretch to Figma child alignment', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Stretch frame',
      width: 200,
      height: 200,
      layoutMode: 'VERTICAL',
      counterAxisAlign: 'STRETCH'
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Inherited stretch',
      width: 50,
      height: 50
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Explicit center',
      width: 50,
      height: 50,
      layoutAlignSelf: 'CENTER'
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Absolute child',
      width: 50,
      height: 50,
      layoutPositioning: 'ABSOLUTE'
    })

    const exported = await exportFigFile(graph)
    const nodeChanges = decodeExport(exported).nodeChanges

    expect(nodeChanges.find((node) => node.name === frame.name)?.stackCounterAlignItems).toBe('MIN')
    expect(nodeChanges.find((node) => node.name === 'Inherited stretch')?.stackChildAlignSelf).toBe(
      'STRETCH'
    )
    expect(nodeChanges.find((node) => node.name === 'Explicit center')?.stackChildAlignSelf).toBe(
      'CENTER'
    )
    expect(
      nodeChanges.find((node) => node.name === 'Absolute child')?.stackChildAlignSelf
    ).toBeUndefined()

    const reimported = await parseFigFile(
      exported.buffer.slice(exported.byteOffset, exported.byteOffset + exported.byteLength)
    )
    const importedNodes = reimported.getAllNodes()
    expect(importedNodes.find((node) => node.name === 'Stretch frame')?.counterAxisAlign).toBe(
      'MIN'
    )
    expect(importedNodes.find((node) => node.name === 'Inherited stretch')?.layoutAlignSelf).toBe(
      'STRETCH'
    )
  })

  test('exports an empty frame with counter-axis stretch', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('FRAME', page.id, {
      name: 'Empty stretch frame',
      width: 200,
      height: 200,
      layoutMode: 'HORIZONTAL',
      counterAxisAlign: 'STRETCH'
    })

    const exported = await exportFigFile(graph)
    const frame = decodeExport(exported).nodeChanges.find(
      (node) => node.name === 'Empty stretch frame'
    )
    expect(frame?.stackCounterAlignItems).toBe('MIN')
  })
})
