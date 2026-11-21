import { expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const RED = { r: 1, g: 0, b: 0, a: 1 }

/** A live variable, a deleted one in the same collection, and a deleted collection. */
function graphWithDeletedVariables(): SceneGraph {
  const graph = new SceneGraph()
  const colors = graph.createCollection('Colors')
  graph.createVariable('Accent', 'COLOR', colors.id, RED)
  const old = graph.createVariable('Old accent', 'COLOR', colors.id, RED)
  graph.removeVariable(old.id)
  graph.addVariable({ ...old, deleted: true })
  const glass = graph.createCollection('Glass')
  const tint = graph.createVariable('Tint', 'COLOR', glass.id, RED)
  graph.removeCollection(glass.id)
  graph.addCollection({ ...glass, variableIds: [], deleted: true })
  graph.addVariable({ ...tint, deleted: true })
  return graph
}

function softDeleted(bytes: Uint8Array): Record<string, boolean> {
  const records = parseFigBuffer(Uint8Array.from(bytes).buffer).nodeChanges
  return Object.fromEntries(
    records
      .filter((record) => record.type === 'VARIABLE' || record.type === 'VARIABLE_SET')
      .map((record) => [record.name ?? '', !!record.isSoftDeleted])
  )
}

test('deleted variables and collections are saved deleted and read back deleted', async () => {
  await initCodec()
  const exported = await exportFigFile(graphWithDeletedVariables())
  expect(softDeleted(exported)).toEqual({
    Colors: false,
    Accent: false,
    'Old accent': true,
    Glass: true,
    Tint: true
  })
  const imported = await parseFigFile(Uint8Array.from(exported).buffer)
  expect(imported.getLiveVariables().map((variable) => variable.name)).toEqual(['Accent'])
  expect(imported.getLiveCollections().map((collection) => collection.name)).toEqual(['Colors'])
  const old = [...imported.variables.values()].find((variable) => variable.name === 'Old accent')
  expect(imported.resolveColorVariable(old?.id ?? '')).toEqual(RED)
})

test('a save that rewrites the variables keeps the deleted ones', async () => {
  await initCodec()
  const imported = await parseFigFile(
    Uint8Array.from(await exportFigFile(graphWithDeletedVariables())).buffer
  )
  const accent = imported.getLiveVariables().find((variable) => variable.name === 'Accent')
  if (!accent) throw new Error('Missing Accent')
  const mode = imported.variableCollections.get(accent.collectionId)?.defaultModeId ?? ''
  accent.valuesByMode[mode] = { r: 0, g: 1, b: 0, a: 1 }
  expect(softDeleted(await exportFigFile(imported))).toMatchObject({
    Accent: false,
    'Old accent': true,
    Glass: true,
    Tint: true
  })
})
