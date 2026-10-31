import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

beforeAll(async () => {
  await initCodec()
})

function cardWithTag() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const tag = graph.createNode('COMPONENT', page, { name: 'Tag', width: 80, height: 24 })
  graph.createNode('TEXT', tag.id, { name: 'Label', text: 'Tag', fontSize: 12 })
  const card = graph.createNode('COMPONENT', page, { name: 'Card', width: 200, height: 100, y: 200 })
  const nested = expectDefined(graph.createInstance(tag.id, card.id))
  const [nestedLabel] = graph.getChildren(nested.id)
  graph.updateNode(nestedLabel.id, { text: 'Práctica guiada' })
  recordInstanceOverride(graph, nestedLabel.id, ['text'])
  return { graph, page, card }
}

test('a detached instance keeps the text its component gave a nested instance', async () => {
  const { graph, page, card } = cardWithTag()
  const instance = expectDefined(graph.createInstance(card.id, page, { y: 400 }))
  graph.detachInstance(instance.id)
  const [tagCopy] = graph.getChildren(instance.id)
  expect(graph.getChildren(tagCopy.id)[0].text).toBe('Práctica guiada')

  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
  const frame = expectDefined(
    [...reopened.getAllNodes()].find((node) => node.type === 'FRAME' && node.name === 'Card'),
    'reopened detached card'
  )
  const [reopenedTag] = reopened.getChildren(frame.id)
  expect(reopenedTag.type).toBe('INSTANCE')
  expect(reopened.getChildren(reopenedTag.id)[0].text).toBe('Práctica guiada')
})
