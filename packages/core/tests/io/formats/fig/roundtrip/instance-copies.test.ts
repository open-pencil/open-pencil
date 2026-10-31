import { expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { populateAllFigPages } from '#core/io/formats/fig'

setDefaultTimeout(60_000)

async function reopen(graph: SceneGraph): Promise<SceneGraph> {
  const bytes = await exportFigFile(graph)
  const reopened = await readFigFile(new File([bytes.slice()], 'Button.fig'))
  populateAllFigPages(reopened)
  return reopened
}

test('a reopened document saves after its component swaps a layer for a namesake', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const [page] = graph.getPages()
  const component = graph.createNode('COMPONENT', page.id, { name: 'Button' })
  graph.createNode('TEXT', component.id, { name: 'Label', text: 'Old' })
  graph.createInstance(component.id, page.id, { name: 'Placed' })
  const reopened = await reopen(graph)
  const main = expectDefined(
    [...reopened.getAllNodes()].find((node) => node.type === 'COMPONENT'),
    'component'
  )
  const old = expectDefined(reopened.getChildren(main.id)[0], 'label')

  // Both edits land before the instances sync, as one batch of the editor's sync does.
  reopened.createNode('TEXT', main.id, { name: 'Label', text: 'New' })
  reopened.deleteNode(old.id)
  reopened.syncInstances(main.id)

  const saved = await reopen(reopened)
  const placed = expectDefined(
    [...saved.getAllNodes()].find((node) => node.name === 'Placed'),
    'instance'
  )
  expect(saved.getChildren(placed.id).map((node) => node.text)).toEqual(['New'])
})
