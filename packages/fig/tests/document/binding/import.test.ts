import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import fixture from '#tests/fixtures/nested-binding-ownership-records.json'

test('binding patches keep unrelated inherited fields in their original units', () => {
  const changes = structuredClone(fixture.nodeChanges) as NodeChange[]
  const inner = changes.find((node) => node.guid?.sessionID === 1 && node.guid.localID === 2)
  if (!inner) throw new Error('Missing component')
  inner.variableConsumptionMap = {
    entries: [
      {
        variableField: 'STACK_SPACING',
        variableData: {
          dataType: 'ALIAS',
          value: { alias: { guid: { sessionID: 293742, localID: 7 } } }
        }
      }
    ]
  }
  const { graph, sources } = materializeDocument(
    changes,
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    { derivedBounds: true }
  )
  const rootId = sources.get('293733:8')
  if (!rootId) throw new Error('Missing owner')
  const nested = graph.getChildren(rootId)[0]
  expect(nested.boundVariables.itemSpacing).toBe(nested.boundVariables.paddingLeft)
  expect(nested.itemSpacing).toBe(3)
  expect(nested.paddingLeft).toBe(6)
  expect(nested.variableBindingScales).toMatchObject({ itemSpacing: 0.25, paddingLeft: 0.5 })
})

test('a direct nested binding retains its alias and declaring-owner units', async () => {
  const { graph, sources } = materializeDocument(
    fixture.nodeChanges as NodeChange[],
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    { derivedBounds: true }
  )
  const rootId = sources.get('293733:8')
  const sourceId = sources.get('1:4')
  if (!rootId || !sourceId) throw new Error('Missing captured sources')
  const children = graph.getChildren(rootId)
  expect(children).toHaveLength(1)
  const nested = children[0]
  expect(nested.boundVariables.paddingLeft).toBe('293742:7')
  expect(nested.variableBindingScales.paddingLeft).toBe(0.5)
  expect(nested.paddingLeft).toBe(6)
  expect(nested.width).toBe(13.5)
  const canonicalChildren = graph.getChildren(sourceId)
  expect(canonicalChildren).toHaveLength(1)
  const inherited = canonicalChildren[0]
  expect(inherited?.paddingLeft).toBe(10)
  const variable = graph.variables.get('293742:7')
  if (!variable) throw new Error('Missing explicit binding')
  const mode = graph.getNodeVariableModeId(nested.id, variable.collectionId)
  const editor = createEditor({ graph })
  editor.updateVariableValue(variable.id, mode, 16)
  expect(nested.paddingLeft).toBe(8)
  expect(nested.width).toBe(15.5)
  expect(graph.getNode(rootId)?.width).toBe(35.5)
  expect(inherited?.paddingLeft).toBe(10)
  editor.undo.undo()
  expect(nested.paddingLeft).toBe(6)
  editor.updateNodeWithUndo(rootId, { name: 'Direct binding round-trip target' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const { graph: reopened } = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  })
  const roots = [...reopened.getAllNodes()].filter(
    (node) => node.name === 'Direct binding round-trip target'
  )
  expect(roots).toHaveLength(1)
  const restored = reopened.getChildren(roots[0].id)[0]
  expect(restored.paddingLeft).toBe(6)
  expect(restored.boundVariables.paddingLeft).toBeDefined()
  expect(restored.variableBindingScales.paddingLeft).toBe(0.5)
})
