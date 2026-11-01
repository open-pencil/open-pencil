import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile, populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

/** An Icon component, and a Card instance whose slot holds an instance of Icon. */
async function savedDocument(): Promise<Uint8Array> {
  await initCodec()
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const icon = graph.createNode('COMPONENT', pageId, { name: 'Icon' })
  const card = graph.createNode('COMPONENT', pageId, {
    name: 'Card',
    componentPropertyDefinitions: [
      { id: 'card:body', name: 'Body', type: 'SLOT', defaultValue: '' }
    ]
  })
  const body = graph.createNode('FRAME', card.id, {
    name: 'Body',
    componentPropertyReferences: [{ propertyId: 'card:body', field: 'SLOT_CONTENT' }]
  })
  graph.createNode('TEXT', body.id, { name: 'Default', text: 'Default' })
  const instance = expectDefined(graph.createInstance(card.id, pageId))
  const slot = expectDefined(graph.getChildren(instance.id).find((child) => slotPropertyId(child)))
  expectDefined(graph.createInstance(icon.id, slot.id))
  graph.updateNode(instance.id, { componentPropertyAssignments: { 'card:body': '' } })
  return exportFigFile(graph)
}

test('a component moved to another parent is saved once when an instance of it sits in slot content', async () => {
  const graph = await parseFigFile((await savedDocument()).slice().buffer)
  populateAllFigPages(graph)
  const icon = expectDefined(
    [...graph.nodes.values()].find((node) => node.type === 'COMPONENT' && node.name === 'Icon')
  )
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Moved to' })
  graph.reparentNode(icon.id, frame.id)

  const saved = await exportFigFile(graph)
  const records = parseFigBuffer(saved.slice().buffer).nodeChanges
  const guids = records.flatMap((record) => (record.guid ? [guidToString(record.guid)] : []))
  expect(guids.filter((guid, index) => guids.indexOf(guid) !== index)).toEqual([])
  const record = expectDefined(
    records.find((candidate) => candidate.guid && guidToString(candidate.guid) === icon.id)
  )
  expect(guidToString(expectDefined(record.parentIndex?.guid))).toBe(frame.id)

  const reopened = await parseFigFile(saved.slice().buffer)
  populateAllFigPages(reopened)
  const moved = expectDefined(
    [...reopened.nodes.values()].find((node) => node.type === 'COMPONENT' && node.name === 'Icon')
  )
  expect(reopened.getNode(expectDefined(moved.parentId))?.name).toBe('Moved to')
  expect(reopened.getChildren(reopened.getPages()[0].id).map((node) => node.name)).not.toContain(
    'Icon'
  )
})
