import { beforeAll, expect, test } from 'bun:test'

import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'

import { FigmaAPI } from '#core/figma-api'
import { exportFigFile, parseFigFile } from '#core/io/formats/fig'

beforeAll(async () => {
  await initCodec()
})

/**
 * A file with a paint style no layer uses and a text style deleted while a text still uses it,
 * as Figma keeps one: soft deleted, on its internal canvas with the file's other styles.
 */
async function styledFile(): Promise<Uint8Array> {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
  const unused = figma.createPaintStyle()
  unused.name = 'Unused'
  const deleted = figma.createTextStyle()
  deleted.name = 'Deleted'
  const text = figma.createText()
  text.name = 'Label'
  text.characters = 'Hi'
  await text.setTextStyleIdAsync(deleted.id)
  const node = graph.getSharedStyleNode(deleted.id, 'TEXT')
  if (!node) throw new Error('Expected the text style node')
  graph.updateNode(node.id, { sharedStyleDeleted: true })
  return exportFigFile(graph)
}

test('a file opens with every style it has not deleted, used or not', async () => {
  const saved = await styledFile()
  const records = parseFigBuffer(saved.slice().buffer).nodeChanges
  expect(records.find((record) => record.name === 'Deleted')?.isSoftDeleted).toBe(true)
  expect(records.find((record) => record.name === 'Unused')?.isSoftDeleted).toBeUndefined()

  const reopened = await parseFigFile(saved.slice().buffer)
  const label = [...reopened.getAllNodes()].find((node) => node.name === 'Label')
  const kept = reopened.getSharedStyleNode(label?.textStyleId ?? '', 'TEXT')

  expect(getSharedStyles(reopened, 'fill').map((style) => style.name)).toEqual(['Unused'])
  expect(getSharedStyles(reopened, 'text')).toEqual([])
  expect([kept?.name, kept?.sharedStyleDeleted]).toEqual(['Deleted', true])
  const api = new FigmaAPI(reopened)
  expect((await api.getLocalPaintStylesAsync()).map((style) => style.name)).toEqual(['Unused'])
  expect(await api.getLocalTextStylesAsync()).toEqual([])
})
