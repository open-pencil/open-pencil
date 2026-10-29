import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

async function reopen(graph: SceneGraph): Promise<SceneGraph> {
  return parseFigFile((await exportFigFile(graph)).slice().buffer)
}

function layerIds(graph: SceneGraph): string[] {
  return [...graph.getAllNodes()].map((node) => node.id).toSorted()
}

describe('.fig layer ids', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('a layer keeps its id through a save and a reopen, as do layers added after opening', async () => {
    const source = new SceneGraph()
    const page = source.getPages()[0].id
    const frame = source.createNode('FRAME', page, { name: 'Card', width: 200, height: 100 })
    source.createNode('RECTANGLE', frame.id, { name: 'Background', width: 200, height: 100 })
    source.addPage('Second')

    const opened = await reopen(source)
    const added = opened.createNode('ELLIPSE', opened.getPages()[0].id, { name: 'Added' })
    const before = layerIds(opened)
    const reopened = await reopen(opened)

    expect(layerIds(reopened)).toEqual(before)
    expect(reopened.getNode(added.id)?.name).toBe('Added')
    expect(opened.rootId).toBe(source.rootId)
    expect(reopened.rootId).toBe(source.rootId)
  })

  test('every open of the same file gives every layer the same id, inside instances too', async () => {
    const source = new SceneGraph()
    const page = source.getPages()[0].id
    const component = source.createNode('COMPONENT', page, { name: 'Button', width: 80, height: 32 })
    source.createNode('TEXT', component.id, { name: 'Label', text: 'Go' })
    source.createInstance(component.id, page)
    const bytes = await exportFigFile(source)

    const first = await parseFigFile(bytes.slice().buffer)
    const second = await parseFigFile(bytes.slice().buffer)

    expect(layerIds(second)).toEqual(layerIds(first))
  })
})
