import { beforeAll, expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { readFixtureArrayBuffer } from '#core-tests/helpers/fig/fixtures'
import { uniq } from 'es-toolkit/array'
import { isEqual } from 'es-toolkit/predicate'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph } from '@open-pencil/scene-graph'

setDefaultTimeout(120_000)

beforeAll(async () => {
  await initCodec()
})

function recordsOf(bytes: ArrayBuffer | Uint8Array) {
  const buffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes
  const { nodeChanges } = parseFigBuffer(buffer as ArrayBuffer)
  return new Map(
    nodeChanges.flatMap((record) => (record.guid ? [[guidToString(record.guid), record]] : []))
  )
}

/** The records of `after` that differ from `before`, with the fields that do. */
function changes(before: Map<string, NodeChange>, after: Map<string, NodeChange>) {
  const result = new Map<string, string[]>()
  for (const [guid, record] of after) {
    const saved = before.get(guid)
    if (!saved) continue
    const keys = uniq([...Object.keys(saved), ...Object.keys(record)])
    const fields = keys.filter((field) => !isEqual(saved[field], record[field]))
    if (fields.length > 0) result.set(guid, fields)
  }
  return result
}

async function openGoldPreview(): Promise<{ bytes: ArrayBuffer; graph: SceneGraph }> {
  const bytes = readFixtureArrayBuffer('gold-preview.fig')
  return { bytes, graph: await parseFigFile(bytes.slice(0), { populate: 'first-page' }) }
}

test('an edit rewrites only the fields it changed, keeping those OpenPencil does not model', async () => {
  const { bytes, graph } = await openGoldPreview()
  const list = expectDefined([...graph.nodes.values()].find((node) => node.name === 'Checked List'))
  const [instance] = graph.getChildren(list.id)
  graph.updateNode(instance.id, { name: 'Lists renamed' })

  const changed = changes(recordsOf(bytes), recordsOf(await exportFigFile(graph)))
  // Figma's own fields, its library links, and the overrides it saved all stay; the overrides
  // only gain the name, which Figma shows from the one at the instance's own path.
  expect([...changed.values()]).toEqual([['name', 'symbolData']])
})

test('renaming an instance adds its name to the overrides Figma saved, and changes no other', async () => {
  const { bytes, graph } = await openGoldPreview()
  const list = expectDefined([...graph.nodes.values()].find((node) => node.name === 'Checked List'))
  const [instance] = graph.getChildren(list.id)
  const saved = recordsOf(bytes)
  const listGuid = [...saved].find(([, record]) => record.name === 'Checked List')?.[0]
  const [guid] = expectDefined(
    [...saved]
      .filter(([, record]) => record.type === 'INSTANCE' && record.parentIndex?.guid)
      .filter(([, record]) => guidToString(expectDefined(record.parentIndex?.guid)) === listGuid)
      .toSorted(([, a], [, b]) =>
        (a.parentIndex?.position ?? '').localeCompare(b.parentIndex?.position ?? '')
      )
      .at(0)
  )
  createEditor({ graph }).updateNodeWithUndo(instance.id, { name: 'Lists renamed' }, 'Rename')

  const before = expectDefined(saved.get(guid))
  const after = expectDefined(recordsOf(await exportFigFile(graph)).get(guid))
  type Override = [path: string, fields: object]
  const overrides = (record: NodeChange): Override[] =>
    symbolOverridesOf(record).map(({ guidPath, ...fields }) => [JSON.stringify(guidPath), fields])
  // Figma shows an instance's own name from the override on its own path, beside its size.
  const renamed = overrides(before).map(([path, fields]): Override =>
    'stackCounterSizing' in fields ? [path, { ...fields, name: 'Lists renamed' }] : [path, fields]
  )
  expect(overrides(after)).toEqual(renamed)
})

test('a mode added to a collection of library aliases keeps the file as Figma saved it', async () => {
  const { bytes, graph } = await openGoldPreview()
  const collection = expectDefined(
    [...graph.variableCollections.values()].find((candidate) => candidate.name === 'Tokens')
  )
  graph.createMode(collection.id, 'Added')

  const before = recordsOf(bytes)
  const after = recordsOf(await exportFigFile(graph))
  const changed = changes(before, after)
  // Only the collection's modes and its variables' values change: no layer, and no variable's
  // library identity.
  expect(new Set([...changed.values()].flat())).toEqual(
    new Set(['variableSetModes', 'variableDataValues'])
  )
  const set = expectDefined(after.get(guidToString(expectDefined(before.get(collection.id)?.guid))))
  const saved = expectDefined(before.get(collection.id)?.variableSetModes)
  expect(set.variableSetModes?.slice(0, saved.length)).toEqual(saved)
  // Values aliasing library variables still name them by key, as Figma writes them.
  for (const guid of changed.keys()) {
    const entries = after.get(guid)?.variableDataValues?.entries ?? []
    for (const entry of entries) expect(entry.variableData?.value?.alias?.guid).toBeUndefined()
  }
})

test('layers using an edited variable, through an alias too, save the color it resolves to', async () => {
  const { bytes, graph } = await openGoldPreview()
  const blue = expectDefined(
    [...graph.variables.values()].find((variable) => variable.name === 'Colors/Blue/500')
  )
  const collection = expectDefined(graph.variableCollections.get(blue.collectionId))
  const editor = createEditor({ graph })
  for (const mode of collection.modes)
    editor.updateVariableValue(blue.id, mode.modeId, { r: 1, g: 0, b: 0, a: 1 })

  const saved = recordsOf(bytes)
  const after = recordsOf(await exportFigFile(graph))
  // Figma draws the color a paint saves until it resolves the binding again, so the file must
  // carry the new one; this layer binds Theme/Default/Primary 500, which aliases the blue.
  const vector = expectDefined([...after.values()].find((record) => record.name === 'Vector 2191'))
  expect(vector.fillPaints?.[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  const fields = uniq([...changes(saved, after).values()].flat())
  expect(fields.toSorted()).toEqual(['fillPaints', 'variableDataValues'])
})
