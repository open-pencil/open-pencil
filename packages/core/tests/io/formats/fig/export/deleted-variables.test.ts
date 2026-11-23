import { expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const RED = { r: 1, g: 0, b: 0, a: 1 }
const GREEN = { r: 0, g: 1, b: 0, a: 1 }

/** A live variable, a deleted one in the same collection, and a deleted collection. */
function graphWithDeletedVariables(): SceneGraph {
  const graph = new SceneGraph()
  const colors = graph.createCollection('Colors')
  graph.createVariable('Accent', 'COLOR', colors.id, RED)
  const old = graph.createVariable('Old accent', 'COLOR', colors.id, RED)
  graph.addVariable({ ...old, deleted: true })
  const glass = graph.createCollection('Glass')
  const tint = graph.createVariable('Tint', 'COLOR', glass.id, RED)
  graph.removeCollection(glass.id)
  graph.addCollection({ ...glass, variableIds: [], deleted: true })
  graph.addVariable({ ...tint, deleted: true })
  return graph
}

function variableRecords(bytes: Uint8Array) {
  return parseFigBuffer(Uint8Array.from(bytes).buffer).nodeChanges.filter(
    (record) => record.type === 'VARIABLE' || record.type === 'VARIABLE_SET'
  )
}

function softDeleted(bytes: Uint8Array): Record<string, boolean> {
  return Object.fromEntries(
    variableRecords(bytes).map((record) => [record.name ?? '', !!record.isSoftDeleted])
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
  imported.willChangeVariable(accent.id)
  accent.valuesByMode = { ...accent.valuesByMode, [mode]: GREEN }
  // A new variable takes a GUID too, which must not be one a deleted variable keeps.
  imported.createVariable('New', 'COLOR', accent.collectionId, RED)
  const saved = await exportFigFile(imported)
  const reopened = await parseFigFile(Uint8Array.from(saved).buffer)
  const savedAccent = reopened.getLiveVariables().find((variable) => variable.name === 'Accent')
  expect(reopened.resolveColorVariable(savedAccent?.id ?? '')).toEqual(GREEN)
  expect(softDeleted(saved)).toEqual({
    Colors: false,
    Accent: false,
    New: false,
    'Old accent': true,
    Glass: true,
    Tint: true
  })
  const guids = variableRecords(saved).map((record) => JSON.stringify(record.guid))
  expect(new Set(guids).size).toBe(guids.length)
})

test('no record a save writes takes the GUID a deleted variable keeps', async () => {
  await initCodec()
  const graph = new SceneGraph()
  // IDs as a file's GUIDs spell them, in the session new records are numbered in.
  const made = graph.createCollection('Colors')
  graph.removeCollection(made.id)
  const colors = { ...made, id: '0:3', variableIds: [] }
  graph.addCollection(colors)
  graph.createVariable('Accent', 'COLOR', colors.id, RED)
  const old = graph.createVariable('Old accent', 'COLOR', colors.id, RED)
  graph.removeVariable(old.id)
  graph.addVariable({ ...old, id: '0:4', deleted: true })
  const records = parseFigBuffer(Uint8Array.from(await exportFigFile(graph)).buffer).nodeChanges
  const guids = records.map((record) => `${record.guid?.sessionID}:${record.guid?.localID}`)
  expect(guids).toContain('0:4')
  expect(new Set(guids).size).toBe(guids.length)
})
