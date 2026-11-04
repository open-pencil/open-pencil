import { expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer, patchFigArchive } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

test('color expressions survive fresh export, import, editing and patched export', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const collection = graph.createCollection('Colors')
  const base = graph.createVariable('Base', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  graph.createVariable('Derived', 'COLOR', collection.id, {
    expression: 'COMPOSE_COLOR',
    color: { aliasId: base.id },
    opacity: 20
  })
  const exported = await exportFigFile(graph)
  const record = parseFigBuffer(Uint8Array.from(exported).buffer).nodeChanges.find(
    (node) => node.name === 'Derived'
  )
  expect(
    record?.variableDataValues?.entries?.[0].variableData.value?.expressionValue
  ).toMatchObject({
    expressionFunction: 'COMPOSE_COLOR',
    expressionArguments: [{ dataType: 'ALIAS' }, { dataType: 'FLOAT', value: { floatValue: 20 } }]
  })
  if (!record) throw new Error('Missing exported expression')
  // Fields retained by Figma but not represented in the editable variable model.
  const archivedRecord = { ...record, sortPosition: 'preserved-order', isSoftDeleted: false }
  const annotated = patchFigArchive(
    Uint8Array.from(exported).buffer,
    {
      records: [archivedRecord],
      blobs: [],
      removed: [],
      replaceVariables: false
    },
    { thumbnailPNG: new Uint8Array(), metaJSON: '{}', images: [] }
  )
  const imported = await parseFigFile(Uint8Array.from(annotated).buffer)
  const importedBase = [...imported.variables.values()].find((v) => v.name === 'Base')
  const importedDerived = [...imported.variables.values()].find((v) => v.name === 'Derived')
  if (!importedBase || !importedDerived) throw new Error('Variables missing after import')
  const mode = imported.getActiveModeId(importedBase.collectionId)
  expect(imported.resolveColorVariable(importedDerived.id)).toEqual({ r: 1, g: 0, b: 0, a: 0.2 })
  importedBase.valuesByMode[mode] = { r: 0, g: 1, b: 0, a: 1 }
  const saved = await exportFigFile(imported)
  expect(
    parseFigBuffer(Uint8Array.from(saved).buffer).nodeChanges.find(
      (node) => node.name === 'Derived'
    )
  ).toEqual(archivedRecord)
  const reopened = await parseFigFile(Uint8Array.from(saved).buffer)
  const derived = [...reopened.variables.values()].find((v) => v.name === 'Derived')
  expect(reopened.resolveColorVariable(derived?.id ?? '')).toEqual({ r: 0, g: 1, b: 0, a: 0.2 })
  expect(Object.values(derived?.valuesByMode ?? {})[0]).toMatchObject({
    expression: 'COMPOSE_COLOR',
    opacity: 20
  })
})
