import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

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
