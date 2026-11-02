import { expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { populateAllFigPages } from '#core/io/formats/fig'

setDefaultTimeout(60_000)

test('a hug instance keeps the height its own text laid it out to when reopened', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const [page] = graph.getPages()
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'Tip',
    width: 320,
    height: 60,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    paddingTop: 20,
    paddingBottom: 20
  })
  graph.createNode('TEXT', component.id, {
    name: 'Body',
    text: 'One line.',
    width: 280,
    height: 20,
    textAutoResize: 'HEIGHT'
  })
  const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
  const body = expectDefined(graph.getChildren(instance.id)[0], 'instance body')
  // Four lines of text, and the hug frame laid out around them.
  graph.updateNode(body.id, {
    text: 'Four lines of text, as the layout measured them.',
    height: 80
  })
  graph.updateNode(instance.id, { height: 120 })

  const bytes = await exportFigFile(graph)
  const reopened = await readFigFile(new File([bytes.slice()], 'Tip.fig'))
  populateAllFigPages(reopened)
  const reopenedInstance = [...reopened.getAllNodes()].find((node) => node.type === 'INSTANCE')
  expect(reopenedInstance?.height).toBe(120)
  expect(reopened.getChildren(expectDefined(reopenedInstance, 'instance').id)[0]?.height).toBe(80)
})
