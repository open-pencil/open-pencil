import { beforeAll, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'

beforeAll(async () => {
  await initCodec()
})

test('exports shared styles once even when present in a normal page subtree', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id)
  graph.createNode('TEXT', frame.id, {
    name: 'Shared typography',
    sharedStyleType: 'TEXT',
    text: 'Ag'
  })
  const bytes = await exportFigFile(graph)
  const { nodeChanges } = parseFigBuffer(bytes.buffer as ArrayBuffer)
  const styles = nodeChanges.filter((node) => node.name === 'Shared typography')
  expect(styles).toHaveLength(1)
  const ids = nodeChanges.map((node) => JSON.stringify(node.guid))
  expect(new Set(ids).size).toBe(ids.length)
})

test('names local styles by the records it writes for them, whatever their ids', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  for (const [name, id, type] of [
    ['Imported', '1:10', 'FILL'],
    ['Tokens', 'style:a1b2c3d4e5f6', 'FILL'],
    ['Heading', 'style:0f9e8d7c6b5a', 'TEXT']
  ] as const) {
    const style = graph.createNode(type === 'TEXT' ? 'TEXT' : 'RECTANGLE', page.id, {
      name,
      sharedStyleType: type,
      internalOnly: true
    })
    style.source.id = id
    graph.createNode(type === 'TEXT' ? 'TEXT' : 'RECTANGLE', page.id, {
      name: `${name} target`,
      ...(type === 'TEXT' ? { textStyleId: id } : { fillStyleId: id })
    })
  }

  const parsed = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  for (const name of ['Imported', 'Tokens', 'Heading']) {
    const definition = parsed.nodeChanges.find((change) => change.name === name && change.styleType)
    const target = parsed.nodeChanges.find((change) => change.name === `${name} target`)
    const reference = target?.styleIdForFill ?? target?.styleIdForText
    expect(definition?.guid).toBeDefined()
    expect(reference?.guid).toEqual(definition?.guid)
  }
})

test('reopen layers and ranges with the styles made in OpenPencil they use', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const fill = graph.createNode('RECTANGLE', page.id, {
    name: 'Brand',
    sharedStyleType: 'FILL',
    internalOnly: true
  })
  fill.source.id = 'style:a1b2c3d4e5f6'
  const heading = graph.createNode('TEXT', page.id, {
    name: 'Heading',
    sharedStyleType: 'TEXT',
    internalOnly: true,
    fontSize: 28
  })
  heading.source.id = 'style:0f9e8d7c6b5a'
  graph.createNode('TEXT', page.id, {
    name: 'Styled',
    text: 'Title body',
    fillStyleId: fill.source.id,
    styleRuns: [{ start: 0, length: 5, style: { textStyleId: heading.source.id, fontSize: 28 } }]
  })

  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const styled = [...reopened.getAllNodes()].find((node) => node.name === 'Styled')
  const named = (kind: 'fill' | 'text', id: string | null | undefined) =>
    getSharedStyles(reopened, kind).find((style) => style.id === id)?.name
  expect(named('fill', styled?.fillStyleId)).toBe('Brand')
  expect(named('text', styled?.styleRuns[0]?.style.textStyleId)).toBe('Heading')
})

test('names a library style by its key, as Figma does, on layers and ranges', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const style = graph.createNode('TEXT', page.id, {
    name: 'LG/Medium',
    sharedStyleType: 'TEXT',
    internalOnly: true
  })
  style.source.id = '1:42'
  style.source.fig.rawNodeFields = { key: 'c98daa82', version: '4169:25' }
  graph.createNode('TEXT', page.id, {
    name: 'Styled',
    text: 'Title body',
    textStyleId: '1:42',
    styleRuns: [{ start: 0, length: 5, style: { textStyleId: '1:42' } }]
  })

  const parsed = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const styled = parsed.nodeChanges.find((change) => change.name === 'Styled')
  const library = { assetRef: { key: 'c98daa82', version: '4169:25' } }
  expect(styled?.styleIdForText).toEqual(library)
  expect(styled?.textData?.styleOverrideTable?.[0]?.styleIdForText).toEqual(library)
})

test('gives styles whose ids spell one GUID records of their own', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  for (const [name, id] of [
    ['Plain', '1:10'],
    ['Padded', '01:010']
  ]) {
    const style = graph.createNode('RECTANGLE', page.id, {
      name,
      sharedStyleType: 'FILL',
      internalOnly: true
    })
    style.source.id = id
  }

  const parsed = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const guids = ['Plain', 'Padded'].map((name) => {
    const guid = parsed.nodeChanges.find((change) => change.name === name)?.guid
    expect(guid).toBeDefined()
    return JSON.stringify(guid)
  })
  expect(new Set(guids).size).toBe(2)
})
