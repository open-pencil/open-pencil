import { expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

test('saves only the values of modes the collection lists, so the file opens again', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const collection = graph.createCollection('Brand')
  const variable = graph.createVariable('space', 'FLOAT', collection.id, 8)
  // A value left for a mode the collection does not list.
  variable.valuesByMode['gone'] = 4

  const bytes = await exportFigFile(graph)
  const written = parseFigBuffer(bytes.slice().buffer).nodeChanges.find(
    (change) => change.type === 'VARIABLE'
  )
  expect(written?.variableDataValues?.entries).toHaveLength(1)
  const reopened = await parseFigFile(bytes.slice().buffer)
  const [saved] = reopened.variables.values()
  expect(Object.values(saved.valuesByMode)).toEqual([8])
})
