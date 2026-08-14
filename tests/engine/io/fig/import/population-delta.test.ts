import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  applyFigPopulationDelta,
  buildFigPopulationDelta,
  installFigMutationJournal
} from '#core/kiwi/fig/population/delta'

describe('FIG population deltas', () => {
  test('captures created, updated, and deleted nodes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const updated = graph.createNode('RECTANGLE', page.id, { name: 'Before' })
    const deleted = graph.createNode('RECTANGLE', page.id, { name: 'Deleted' })
    const journal = installFigMutationJournal(graph)
    graph.updateNode(updated.id, { name: 'After', x: 12 })
    graph.deleteNode(deleted.id)
    const created = graph.createNode('TEXT', page.id, { text: 'Created' })
    journal.stop()
    const delta = buildFigPopulationDelta(graph, journal, [page.id])
    expect(delta.created.map(([id]) => id)).toEqual([created.id])
    expect(delta.updated).toContainEqual([
      updated.id,
      expect.objectContaining({ name: 'After', x: 12 })
    ])
    expect(delta.deleted).toEqual([deleted.id])
  })

  test('applies created, updated, deleted, indexed, and event-visible changes', () => {
    const source = new SceneGraph()
    const page = source.getPages()[0]
    const updated = source.createNode('RECTANGLE', page.id, { name: 'Before' })
    const deleted = source.createNode('RECTANGLE', page.id, { name: 'Deleted' })
    const target = new SceneGraph()
    target.rootId = source.rootId
    target.nodes = structuredClone(source.nodes)
    const journal = installFigMutationJournal(source)
    source.updateNode(updated.id, { name: 'After', visible: false })
    source.deleteNode(deleted.id)
    const component = source.createNode('COMPONENT', page.id, { name: 'Component' })
    const created = source.createNode('INSTANCE', page.id, { componentId: component.id })
    journal.stop()
    const delta = buildFigPopulationDelta(source, journal, [page.id])
    const events: string[] = []
    target.onNodeEvents({
      created: (node) => events.push(`created:${node.id}`),
      updated: (id) => events.push(`updated:${id}`),
      deleted: (id) => events.push(`deleted:${id}`)
    })

    applyFigPopulationDelta(target, delta)

    expect(target.getNode(updated.id)).toMatchObject({ name: 'After', visible: false })
    expect(target.getNode(deleted.id)).toBeUndefined()
    expect(target.getNode(created.id)).toMatchObject({ componentId: component.id })
    expect(target.instanceIndex.get(component.id)).toEqual(new Set([created.id]))
    expect(events).toContain(`updated:${updated.id}`)
    expect(events).toContain(`deleted:${deleted.id}`)
    expect(events).toContain(`created:${created.id}`)
  })
})
