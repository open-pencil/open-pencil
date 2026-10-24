import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/core/kiwi'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

test('move_page preserves the requested order after saving and reopening a .fig file', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const [first] = graph.getPages()
  if (!first) throw new Error('Expected a default page')

  const popover = graph.addPage('Popover')
  const internal = graph.addPage('Internal Only Canvas')
  graph.updateNode(internal.id, { internalOnly: true })
  const empty = graph.addPage('Empty')

  const tool = ALL_TOOLS.find((candidate) => candidate.name === 'move_page')
  if (!tool) throw new Error('Missing move_page tool')

  const result = tool.execute(new FigmaAPI(graph), { page_id: empty.id, index: 2 })
  expect(result).toEqual({ id: empty.id, name: 'Empty', index: 2 })
  expect(graph.getPages(true).map((page) => page.id)).toEqual([
    first.id,
    popover.id,
    empty.id,
    internal.id
  ])

  const bytes = await exportFigFile(graph)
  const reopened = await parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate: 'none' })
  expect(reopened.getPages(true).map((page) => page.name)).toEqual([
    'Page 1',
    'Popover',
    'Empty',
    'Internal Only Canvas'
  ])
})
