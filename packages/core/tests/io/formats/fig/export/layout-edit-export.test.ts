import { expect, test } from 'bun:test'

import { guid } from '#core-tests/helpers/fig/guid'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { markFlowChanged } from '#core/layout/derived'
import { createLayoutRunner } from '#core/layout/mutations'

test('retained implicit layout survives import but does not override an explicit sizing edit', async () => {
  await initCodec()
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'FRAME',
      name: 'Layout',
      parentIndex: { guid: guid(2), position: '!' },
      stackMode: 'HORIZONTAL',
      stackPrimarySizing: 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE',
      stackCounterSizing: 'FIXED',
      size: { x: 100, y: 28 }
    }
  ]
  const { graph, sources } = materializeDocument(changes)
  const id = sources.get('1:3')
  if (!id) throw new Error('Missing layout')
  const readSizing = async () => {
    const bytes = await exportFigFile(graph)
    return parseFigBuffer(bytes.buffer as ArrayBuffer).nodeChanges.find((n) => n.name === 'Layout')
      ?.stackPrimarySizing
  }
  expect(await readSizing()).toBe('RESIZE_TO_FIT_WITH_IMPLICIT_SIZE')
  graph.updateNode(id, {
    itemSpacing: 0,
    paddingLeft: 7,
    paddingRight: 9,
    layoutGrow: 0,
    counterAxisAlign: 'MAX',
    layoutDirection: 'RTL'
  })
  const bytes = await exportFigFile(graph)
  const exported = parseFigBuffer(bytes.buffer as ArrayBuffer).nodeChanges.find(
    (node) => node.name === 'Layout'
  )
  expect(exported?.stackSpacing).toBe(0)
  expect(exported?.stackHorizontalPadding).toBe(7)
  expect(exported?.stackPaddingRight).toBe(9)
  expect(exported?.stackChildPrimaryGrow).toBe(0)
  expect(exported?.stackCounterAlignItems).toBe('MAX')
  expect(exported?.stackCounterSizing).toBe('FIXED')
  expect(exported?.pluginData).toContainEqual({
    pluginID: 'open-pencil',
    key: 'layoutDirection',
    value: 'RTL'
  })
  graph.updateNode(id, { primaryAxisSizing: 'FIXED' })
  expect(await readSizing()).toBe('FIXED')
})

test('an edit-caused layout is saved to an imported FIG archive', async () => {
  await initCodec()
  const source = new SceneGraph()
  const sourcePage = source.getPages()[0]
  const parent = source.createNode('FRAME', sourcePage.id, {
    name: 'Hug container',
    width: 320,
    height: 116,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    itemSpacing: 12,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16
  })
  source.createNode('FRAME', parent.id, { name: 'First block', width: 288, height: 40 })
  source.createNode('FRAME', parent.id, { name: 'Last block', width: 288, height: 32 })
  computeAllLayouts(source, sourcePage.id)

  const input = await exportFigFile(source)
  const graph = await parseFigFile(input.slice().buffer as ArrayBuffer)
  const layer = (name: string) => {
    const found = [...graph.getAllNodes()].find((node) => node.name === name)
    if (!found) throw new Error(`Missing ${name}`)
    return found
  }
  const importedParent = layer('Hug container')
  const inserted = graph.createNode('FRAME', importedParent.id, {
    name: 'Inserted block',
    width: 288,
    height: 60
  })
  graph.insertChildAt(inserted.id, importedParent.id, 1)
  // The editor's graph-event bridge marks the flow when children are inserted or reordered.
  markFlowChanged(graph, importedParent.id)
  createLayoutRunner(() => graph).runLayoutForNode(inserted.id)

  expect(importedParent.height).toBe(188)
  expect(layer('Last block').y).toBe(140)

  const saved = await exportFigFile(graph)
  const reopened = await parseFigFile(saved.slice().buffer as ArrayBuffer)
  const reopenedPage = reopened.getPages()[0]
  reopened.applyDerivedLayoutDuring(() => computeAllLayouts(reopened, reopenedPage.id))
  const reopenedLayer = (name: string) => {
    const found = [...reopened.getAllNodes()].find((node) => node.name === name)
    if (!found) throw new Error(`Missing reopened ${name}`)
    return found
  }

  expect(reopenedLayer('Hug container').height).toBe(188)
  expect(reopenedLayer('Last block').y).toBe(140)
  expect(reopenedLayer('Inserted block').y).toBe(68)
})
