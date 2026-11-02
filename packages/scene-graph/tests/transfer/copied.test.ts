import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { remapCopiedReferences } from '@open-pencil/scene-graph/transfer'

const end = (nodeId: string) => ({ nodeId, magnet: 'AUTO' as const, position: { x: 0, y: 0 } })

describe('remapCopiedReferences', () => {
  test('points instances and connector ends at the copies', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const card = graph.createNode('COMPONENT', page, { name: 'Card' })
    const cardCopy = graph.createNode('COMPONENT', page, { name: 'Card' })
    const instance = graph.createNode('INSTANCE', page, { componentId: card.id })
    const link = graph.createNode('CONNECTOR', page, {
      connectorStart: end(card.id),
      connectorEnd: end(instance.id)
    })

    remapCopiedReferences(
      graph,
      new Map([
        [card.id, cardCopy.id],
        [instance.id, instance.id],
        [link.id, link.id]
      ])
    )

    expect(graph.getNode(instance.id)?.componentId).toBe(cardCopy.id)
    expect(graph.getNode(link.id)?.connectorStart?.nodeId).toBe(cardCopy.id)
    expect(graph.getNode(link.id)?.connectorEnd?.nodeId).toBe(instance.id)
  })

  test('leaves a copy alone when no reference it holds was copied', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const card = graph.createNode('COMPONENT', page, { name: 'Card' })
    const instance = graph.createNode('INSTANCE', page, {
      componentId: card.id,
      instanceOverrides: { self: new Map([['name', 'Renamed']]), descendants: new Map() }
    })
    const updated: string[] = []
    graph.onNodeEvents({ updated: (nodeId) => updated.push(nodeId) })

    remapCopiedReferences(graph, new Map([[instance.id, instance.id]]))

    expect(updated).toEqual([])
  })

  test('writes to distinct copies and leaves their sources as they were', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const card = graph.createNode('COMPONENT', page, { name: 'Card' })
    const cardCopy = graph.createNode('COMPONENT', page, { name: 'Card' })
    const instance = graph.createNode('INSTANCE', page, { componentId: card.id })
    const instanceCopy = graph.createNode('INSTANCE', page, { componentId: card.id })
    const ends = { connectorStart: end(card.id), connectorEnd: end(instance.id) }
    const link = graph.createNode('CONNECTOR', page, ends)
    const linkCopy = graph.createNode('CONNECTOR', page, structuredClone(ends))

    remapCopiedReferences(
      graph,
      new Map([
        [card.id, cardCopy.id],
        [instance.id, instanceCopy.id],
        [link.id, linkCopy.id]
      ])
    )

    expect(graph.getNode(instanceCopy.id)?.componentId).toBe(cardCopy.id)
    expect(graph.getNode(linkCopy.id)?.connectorStart?.nodeId).toBe(cardCopy.id)
    expect(graph.getNode(linkCopy.id)?.connectorEnd?.nodeId).toBe(instanceCopy.id)
    expect(graph.getNode(instance.id)?.componentId).toBe(card.id)
    expect(graph.getNode(link.id)?.connectorStart?.nodeId).toBe(card.id)
    expect(graph.getNode(link.id)?.connectorEnd?.nodeId).toBe(instance.id)
  })

  test('remaps a swap set on an instance of a component left behind', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const button = graph.createNode('COMPONENT', page, {
      name: 'Button',
      componentPropertyDefinitions: [
        { id: 'icon', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: '' }
      ]
    })
    const star = graph.createNode('COMPONENT', page, { name: 'Star' })
    const starCopy = graph.createNode('COMPONENT', page, { name: 'Star' })
    const instance = graph.createNode('INSTANCE', page, {
      componentId: button.id,
      componentPropertyAssignments: { icon: star.id }
    })

    remapCopiedReferences(
      graph,
      new Map([
        [star.id, starCopy.id],
        [instance.id, instance.id]
      ])
    )

    expect(graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({ icon: starCopy.id })
  })
})
