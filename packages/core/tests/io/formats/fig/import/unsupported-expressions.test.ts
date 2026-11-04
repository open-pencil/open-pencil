import { expect, test } from 'bun:test'

import { deflateSync } from 'fflate'

import { compressFigDataSync, parseFigBuffer } from '@open-pencil/fig'
import { getCompiledSchema, getSchemaBytes, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { isUnsupportedVariableValue } from '@open-pencil/scene-graph/variables'
import { SceneGraph, type VariableValue } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor/create'
import {
  captureClipboardVariables,
  importClipboardVariables
} from '#core/editor/clipboard/variables'
import { exportFigFile } from '#core/io/formats/fig/export'
import { appendVariableNodeChanges } from '#core/io/formats/fig/export/variables'
import { parseFigFile, parseFigFileViaWorker } from '#core/io/formats/fig/read'
import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'
import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import { populateFigPage } from '#core/kiwi/fig/session/document-state'

/**
 * A file whose `Gap` variable is `VAR_MODE_LOOKUP` over a mode of `Lookup` and that collection's
 * `Compact` variable, with a 91px rectangle bound to it on each of two pages.
 */
async function figWithLookup() {
  const source = new SceneGraph()
  const collection = source.createCollection('Theme')
  const lookup = source.createCollection('Lookup')
  const compact = source.createVariable('Compact', 'FLOAT', lookup.id, 8)
  const gap = source.createVariable('Gap', 'FLOAT', collection.id, 24)
  for (const page of [source.getPages()[0], source.createNode('CANVAS', source.rootId)])
    source.createNode('RECTANGLE', page.id, { width: 91, height: 70, boundVariables: { width: gap.id } })
  const decoded = parseFigBuffer((await exportFigFile(source)).slice().buffer)
  const record = (id: string) =>
    decoded.nodeChanges.find((node) => node.guid && guidToString(node.guid) === id)
  const entry = record(gap.id)?.variableDataValues?.entries?.[0]
  const target = record(compact.id)?.guid
  if (!entry || !target) throw new Error('Missing synthetic variables')
  entry.variableData = {
    dataType: 'EXPRESSION',
    resolvedDataType: 'FLOAT',
    value: {
      expressionValue: {
        expressionFunction: 'VAR_MODE_LOOKUP',
        expressionArguments: [
          {
            dataType: 'MAP',
            value: {
              mapValue: {
                values: [
                  {
                    guidKey: stringToGuid(lookup.defaultModeId),
                    value: { dataType: 'ALIAS', value: { alias: { guid: target } } }
                  }
                ]
              }
            }
          }
        ]
      }
    }
  }
  // Figma saves the size a binding gave; drawing keeps it while the expression has no value.
  for (const node of decoded.nodeChanges)
    if (node.type === 'RECTANGLE') node.size = { x: 91, y: 70 }
  const bytes = compressFigDataSync(
    deflateSync(getSchemaBytes()),
    getCompiledSchema().encodeMessage(decoded),
    new Uint8Array(),
    '{}',
    []
  )
  return {
    bytes,
    data: entry.variableData,
    mode: collection.defaultModeId,
    lookupMode: lookup.defaultModeId,
    compact: compact.id,
    gap: gap.id
  }
}

function lookupOperand(record: NodeChange | undefined) {
  return record?.variableDataValues?.entries?.[0].variableData.value?.expressionValue
    ?.expressionArguments?.[0].value?.mapValue?.values?.[0]
}

test('layers bound to a kept expression open at the size the file saved', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFileViaWorker(file.bytes.slice().buffer, { populate: 'first-page' })
  try {
    populateFigPage(graph, graph.getPages()[1].id)
    expect(graph.getPages().map((page) => graph.getChildren(page.id)[0].width)).toEqual([91, 91])
  } finally {
    releaseFigPopulationWorker(graph)
  }
})

test('saving and reopening writes a kept expression back unchanged', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFile(file.bytes.slice().buffer)
  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
  expect(reopened.variables.get(file.gap)?.valuesByMode[file.mode]).toEqual({
    expression: 'UNSUPPORTED',
    function: 'VAR_MODE_LOOKUP',
    value: { ...file.data },
    references: [file.compact],
    modes: [file.lookupMode]
  })
  expect(reopened.getChildren(reopened.getPages()[0].id)[0].width).toBe(91)
})

test('saving points a kept expression’s aliases and mode keys at the saved GUIDs', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFile(file.bytes.slice().buffer)
  const records: NodeChange[] = []
  appendVariableNodeChanges(
    graph,
    records,
    { sessionID: 0, localID: 1 },
    new Map([[file.compact, { sessionID: 99, localID: 1 }]]),
    new Map([[file.lookupMode, { sessionID: 99, localID: 2 }]])
  )
  expect(lookupOperand(records.find((node) => node.name === 'Gap'))).toMatchObject({
    guidKey: { sessionID: 99, localID: 2 },
    value: { value: { alias: { guid: { sessionID: 99, localID: 1 } } } }
  })
})

test('an alias to a variable the document no longer has is written as the file had it', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFile(file.bytes.slice().buffer)
  graph.removeVariable(file.compact)
  const records: NodeChange[] = []
  appendVariableNodeChanges(graph, records, { sessionID: 0, localID: 1 }, new Map(), new Map())
  expect(lookupOperand(records.find((node) => node.name === 'Gap'))?.value?.value?.alias).toEqual({
    guid: stringToGuid(file.compact)
  })
})

test('pasting a layer bound to a kept expression into another file follows the copied alias and mode', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFile(file.bytes.slice().buffer)
  const rectangle = graph.getChildren(graph.getPages()[0].id)[0]
  const destination = new SceneGraph()
  const transfer = importClipboardVariables(
    destination,
    captureClipboardVariables(graph, [rectangle])
  )
  transfer.apply()
  const gap = transfer.variableIds.get(file.gap) ?? ''
  const compact = transfer.variableIds.get(file.compact) ?? ''
  expect(destination.variables.get(gap)?.valuesByMode[transfer.modeIds.get(file.mode) ?? '']).toMatchObject(
    { expression: 'UNSUPPORTED', references: [compact], modes: [transfer.modeIds.get(file.lookupMode)] }
  )
  const saved = parseFigBuffer((await exportFigFile(destination)).slice().buffer).nodeChanges
  const savedCompact = saved.find((node) => node.name === 'Compact')?.guid
  const savedLookupMode = saved.find((node) => node.name === 'Lookup')?.variableSetModes?.[0]?.id
  expect(savedLookupMode).toBeDefined()
  expect(lookupOperand(saved.find((node) => node.name === 'Gap'))).toMatchObject({
    guidKey: savedLookupMode,
    value: { value: { alias: { guid: savedCompact } } }
  })
})

test('pasting copies a collection that a kept expression reaches only through a mode key', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFile(file.bytes.slice().buffer)
  const size = graph.createCollection('Size')
  const kept = graph.variables.get(file.gap)?.valuesByMode[file.mode]
  if (!isUnsupportedVariableValue(kept)) throw new Error('Missing kept expression')
  kept.modes = [size.defaultModeId]
  const destination = new SceneGraph()
  const transfer = importClipboardVariables(
    destination,
    captureClipboardVariables(graph, [graph.getChildren(graph.getPages()[0].id)[0]])
  )
  transfer.apply()
  const sizeMode = transfer.modeIds.get(size.defaultModeId)
  expect(sizeMode).toBeDefined()
  const gap = destination.variables.get(transfer.variableIds.get(file.gap) ?? '')
  expect(gap?.valuesByMode[transfer.modeIds.get(file.mode) ?? '']).toMatchObject({
    modes: [sizeMode]
  })
})

test('a kept expression can be replaced with a value, and the replacement undone', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFile(file.bytes.slice().buffer)
  const kept = structuredClone(graph.variables.get(file.gap)?.valuesByMode[file.mode])
  const editor = createEditor({ graph })
  editor.updateVariableValue(file.gap, file.mode, 12 satisfies VariableValue)
  expect(graph.resolveVariable(file.gap, file.mode)).toBe(12)
  editor.undoAction()
  expect(graph.variables.get(file.gap)?.valuesByMode[file.mode]).toEqual(kept)
})

test('recovery keeps a kept expression', async () => {
  const file = await figWithLookup()
  const graph = await parseFigFile(file.bytes.slice().buffer)
  const recovered = deserializeSceneGraph(structuredClone(serializeSceneGraph(graph)))
  expect(recovered.variables.get(file.gap)?.valuesByMode[file.mode]).toEqual(
    graph.variables.get(file.gap)?.valuesByMode[file.mode]
  )
})
