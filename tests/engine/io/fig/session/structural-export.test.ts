import { expect, test } from 'bun:test'

import { exportFigFile, initCodec } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import { openReaderSession } from '#core/kiwi/fig/session/reader'

async function sessionWithComponent() {
  await initCodec()
  const source = new SceneGraph()
  const component = source.createNode('COMPONENT', source.getPages()[0].id, { name: 'Component' })
  source.createNode('RECTANGLE', component.id, { name: 'Delete me' })
  const bytes = await exportFigFile(source)
  return openReaderSession(bytes.slice().buffer as ArrayBuffer, 'all')
}

test('loaded structural component edits can be checkpointed and exported', async () => {
  const session = await sessionWithComponent()
  const component = session.graph.getAllNodes().find((node) => node.name === 'Component')
  if (!component) throw new Error('Missing component')
  session.graph.deleteNode(session.graph.getChildren(component.id)[0].id)
  expect(() => session.checkpoint()).not.toThrow()
  await expect(exportFigFile(session.graph)).resolves.toBeInstanceOf(Uint8Array)
})
