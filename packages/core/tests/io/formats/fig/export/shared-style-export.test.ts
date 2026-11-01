import { beforeAll, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'

beforeAll(async () => {
  await initCodec()
})

test('variable-backed text styles survive repeated saves and reopening', async () => {
  let graph = new SceneGraph()
  const page = graph.getPages()[0]
  const collection = graph.createCollection('Typography')
  const size = graph.createVariable('Display size', 'FLOAT', collection.id, 48)
  const tracking = graph.createVariable('Display tracking', 'FLOAT', collection.id, -0.96)
  const definition = graph.createNode('TEXT', page.id, {
    name: 'Display/Large',
    sharedStyleType: 'TEXT',
    internalOnly: true,
    fontSize: 48,
    letterSpacing: { value: -0.96, unit: 'PIXELS' },
    boundVariables: { fontSize: size.id, letterSpacing: tracking.id }
  })
  definition.source.id = 'style:display-large'
  const target = graph.createNode('TEXT', page.id, { name: 'Sample', text: 'Display sample' })
  graph.updateNode(target.id, {
    fontSize: 48,
    letterSpacing: { value: -0.96, unit: 'PIXELS' },
    boundVariables: { fontSize: size.id, letterSpacing: tracking.id },
    textStyleId: definition.source.id
  })

  for (let save = 0; save < 3; save++) {
    const saved = await exportFigFile(graph)
    const parsed = parseFigBuffer(saved.slice().buffer)
    const record = parsed.nodeChanges.find((node) => node.name === 'Sample')
    expect(record?.styleIdForText?.guid).toBeDefined()
    graph = await parseFigFile(saved.slice().buffer)
    const sample = [...graph.nodes.values()].find((node) => node.name === 'Sample')
    expect(sample).toBeDefined()
    expect(
      getSharedStyles(graph, 'text').find((style) => style.id === sample?.textStyleId)?.name
    ).toBe('Display/Large')
    expect(sample?.fontSize).toBe(48)
    expect(sample?.letterSpacing?.unit).toBe('PIXELS')
    expect(sample?.letterSpacing?.value).toBeCloseTo(-0.96)
    expect(Object.keys(sample?.boundVariables ?? {}).sort()).toEqual(['fontSize', 'letterSpacing'])
    // Force a patched write as well as the first full export.
    if (sample) graph.updateNode(sample.id, { text: `Display sample ${save}` })
  }
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

test('reopen a vector region with the paint style made in OpenPencil it uses', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const red = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
  const fill = graph.createNode('RECTANGLE', page.id, {
    name: 'Brand',
    sharedStyleType: 'FILL',
    internalOnly: true,
    fills: [red]
  })
  fill.source.id = 'style:a1b2c3d4e5f6'
  const zero = { x: 0, y: 0 }
  graph.createNode('VECTOR', page.id, {
    name: 'Styled',
    width: 10,
    height: 10,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
        { start: 1, end: 2, tangentStart: zero, tangentEnd: zero },
        { start: 2, end: 0, tangentStart: zero, tangentEnd: zero }
      ],
      regions: [
        { windingRule: 'NONZERO', loops: [[0, 1, 2]], fills: [red], fillStyleId: fill.source.id }
      ]
    }
  })

  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const styled = [...reopened.getAllNodes()].find((node) => node.name === 'Styled')
  const [region] = styled?.vectorNetwork?.regions ?? []
  expect(getSharedStyles(reopened, 'fill').find((style) => style.id === region?.fillStyleId)?.name).toBe(
    'Brand'
  )
  expect(region?.fills?.[0]?.color).toEqual(red.color)
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
