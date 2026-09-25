import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { serializeSceneGraph, deserializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import {
  installFigMutationJournal,
  buildFigPopulationDelta,
  applyFigPopulationDelta
} from '#core/kiwi/fig/population/delta'

test('new-reader page loads transfer through the worker delta contract', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { text: 'Transferred', name: 'Label' })
  const library = source.addPage('Library')
  const component = source.createNode('COMPONENT', library.id, { name: 'Shared' })
  source.createNode('TEXT', component.id, { text: 'Default' })
  source.createInstance(component.id, source.getPages()[0].id)
  source.createInstance(component.id, library.id)
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  const receiver = deserializeSceneGraph(serializeSceneGraph(session.graph))
  const pageId = session.graphPageId(session.pages[0].id)
  if (!pageId) throw new Error('Missing graph page')
  const journal = installFigMutationJournal(session.graph)
  try {
    session.loadPage(session.pages[0].id)
    const delta = buildFigPopulationDelta(session.graph, journal, [pageId])
    applyFigPopulationDelta(receiver, structuredClone(delta))
    expect(
      receiver
        .getChildren(pageId)
        .filter((node) => node.type === 'TEXT')
        .map((node) => node.text)
    ).toEqual(['Transferred'])
    const receivedComponent = [...receiver.getAllNodes()].find((node) => node.type === 'COMPONENT')
    if (!receivedComponent) throw new Error('Missing component dependency')
    const instance = receiver.getChildren(pageId).find((node) => node.type === 'INSTANCE')
    expect(instance?.componentId).toBe(receivedComponent.id)
    expect(receiver.instanceIndex.get(receivedComponent.id)?.has(instance?.id ?? '')).toBe(true)
    expect(receiver.getChildren(pageId).map((node) => node.id)).toEqual(
      session.graph.getChildren(pageId).map((node) => node.id)
    )
  } finally {
    journal.stop()
  }
  const existingComponent = [...receiver.getAllNodes()].find((node) => node.type === 'COMPONENT')
  if (!existingComponent) throw new Error('Missing shared component')
  receiver.updateNode(existingComponent.id, { name: 'Receiver edit' })
  const localInstance = receiver.createInstance(existingComponent.id, pageId)
  if (!localInstance) throw new Error('Missing locally created instance')
  const recoveryGraph = deserializeSceneGraph(serializeSceneGraph(receiver))
  const recoveredComponent = recoveryGraph.getNode(existingComponent.id)
  const resumed = createFigDocumentSession(
    bytes.buffer as ArrayBuffer,
    {},
    {
      graph: recoveryGraph,
      checkpoint: structuredClone(session.checkpoint())
    }
  )
  resumed.loadPage(resumed.pages[1].id)
  expect(recoveredComponent?.name).toBe('Receiver edit')
  expect(recoveryGraph.getNode(existingComponent.id)).toBe(recoveredComponent)
  expect([...recoveryGraph.getAllNodes()].filter((node) => node.type === 'COMPONENT')).toHaveLength(
    1
  )
  expect(recoveryGraph.instanceIndex.get(existingComponent.id)?.has(localInstance.id)).toBe(true)
  const secondJournal = installFigMutationJournal(session.graph)
  try {
    session.loadPage(session.pages[1].id)
    applyFigPopulationDelta(
      receiver,
      structuredClone(
        buildFigPopulationDelta(
          session.graph,
          secondJournal,
          session.graph.getPages().map((page) => page.id)
        )
      )
    )
    expect(receiver.getNode(existingComponent.id)).toBe(existingComponent)
    expect(existingComponent.name).toBe('Receiver edit')
    expect([...receiver.getAllNodes()].filter((node) => node.type === 'COMPONENT')).toHaveLength(1)
    expect(receiver.instanceIndex.get(existingComponent.id)?.size).toBe(3)
    expect(receiver.instanceIndex.get(existingComponent.id)?.has(localInstance.id)).toBe(true)
  } finally {
    secondJournal.stop()
  }
})
