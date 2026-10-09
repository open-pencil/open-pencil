import { describe, expect, test } from 'bun:test'

import {
  getInstanceOverride,
  instanceLayerId,
  instanceLayerSource,
  migrateInstanceLayers,
  overriddenFields,
  parseInstanceLayerId,
  recordInstanceOverride,
  SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Missing value')
  return value
}

/** Card holds a rectangle, a frame with a label, and an instance of Badge with its own dot. */
function kit() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const badge = graph.createNode('COMPONENT', page, { name: 'Badge' })
  const dot = graph.createNode('ELLIPSE', badge.id, { name: 'Dot' })
  const card = graph.createNode('COMPONENT', page, { name: 'Card' })
  const rect = graph.createNode('RECTANGLE', card.id, { name: 'Rect' })
  const frame = graph.createNode('FRAME', card.id, { name: 'Frame' })
  const label = graph.createNode('TEXT', frame.id, { name: 'Label', text: 'Hello' })
  const nested = required(graph.createInstance(badge.id, card.id, { name: 'Nested' }))
  const instance = required(graph.createInstance(card.id, page))
  return { graph, page, badge, dot, card, rect, frame, label, nested, instance }
}

describe('ids of the layers inside instances', () => {
  test('spell the instance and the component layers down to them, as Figma ids do', () => {
    const { graph, rect, frame, label, nested, dot, instance } = kit()
    const ids = (node: SceneNode) => graph.getChildren(node.id).map((child) => child.id)
    expect(ids(instance)).toEqual([
      instanceLayerId(instance.id, [rect.id]),
      instanceLayerId(instance.id, [frame.id]),
      instanceLayerId(instance.id, [nested.id])
    ])
    // Paths cross instances, not frames.
    expect(ids(required(graph.getNode(instanceLayerId(instance.id, [frame.id]))))).toEqual([
      instanceLayerId(instance.id, [label.id])
    ])
    // The component's own nested instance shows Badge through copies named after it.
    expect(ids(nested)).toEqual([instanceLayerId(nested.id, [dot.id])])
    expect(ids(required(graph.getNode(instanceLayerId(instance.id, [nested.id]))))).toEqual([
      instanceLayerId(instance.id, [nested.id, dot.id])
    ])
    expect(parseInstanceLayerId(`I${instance.id};${nested.id};${dot.id}`)).toEqual({
      owner: instance.id,
      path: [nested.id, dot.id]
    })
  })

  test('name the component layer each copy shows, through the copy its component holds', () => {
    const { graph, rect, nested, dot, badge, instance } = kit()
    const copy = (path: string[]) => required(graph.getNode(instanceLayerId(instance.id, path)))
    expect(instanceLayerSource(graph, copy([rect.id]))?.id).toBe(rect.id)
    expect(instanceLayerSource(graph, copy([nested.id, dot.id]))?.id).toBe(
      instanceLayerId(nested.id, [dot.id])
    )
    // A copy of a nested instance shows that instance's component itself.
    expect(copy([nested.id]).componentId).toBe(badge.id)
  })

  test('record overrides on the outermost instance, by path', () => {
    const { graph, nested, dot, instance } = kit()
    const copy = required(graph.getNode(instanceLayerId(instance.id, [nested.id, dot.id])))
    graph.updateNode(copy.id, { opacity: 0.5 })
    recordInstanceOverride(graph, copy.id, ['opacity'])
    expect(getInstanceOverride(instance.instanceOverrides, [nested.id, dot.id], 'opacity')).toBe(
      true
    )
    expect(overriddenFields(graph, copy)).toEqual(new Set(['opacity']))
    const nestedCopy = required(graph.getNode(instanceLayerId(instance.id, [nested.id])))
    expect(nestedCopy.instanceOverrides.layers.size).toBe(0)
  })
})

describe('synchronizing copies', () => {
  test('keeps overridden fields and takes the rest from the component', () => {
    const { graph, rect, instance } = kit()
    const copyId = instanceLayerId(instance.id, [rect.id])
    graph.updateNode(copyId, { opacity: 0.5 })
    recordInstanceOverride(graph, copyId, ['opacity'])
    graph.updateNode(rect.id, { opacity: 0.25, cornerRadius: 6 })
    graph.syncInstances(required(instance.componentId))
    expect(graph.getNode(copyId)?.opacity).toBe(0.5)
    expect(graph.getNode(copyId)?.cornerRadius).toBe(6)
  })

  test('adds copies of new component layers and removes copies of deleted ones', () => {
    const { graph, card, rect, instance } = kit()
    const added = graph.createNode('ELLIPSE', card.id, { name: 'Added' })
    graph.deleteNode(rect.id)
    graph.syncInstances(card.id)
    const ids = graph.getChildren(instance.id).map((child) => child.id)
    expect(ids).toContain(instanceLayerId(instance.id, [added.id]))
    expect(ids).not.toContain(instanceLayerId(instance.id, [rect.id]))
  })

  test('follows the component’s nested instance into its component', () => {
    const { graph, badge, nested, instance } = kit()
    const ring = graph.createNode('RECTANGLE', badge.id, { name: 'Ring' })
    graph.syncInstances(badge.id)
    graph.syncInstances(required(instance.componentId))
    expect(graph.getNode(instanceLayerId(nested.id, [ring.id]))).toBeDefined()
    expect(graph.getNode(instanceLayerId(instance.id, [nested.id, ring.id]))).toBeDefined()
  })
})

describe('swapping a nested instance', () => {
  test('records the swap on the outermost instance and keeps overrides by layer name', () => {
    const { graph, page, nested, dot, instance } = kit()
    const other = graph.createNode('COMPONENT', page, { name: 'Pill' })
    const otherDot = graph.createNode('ELLIPSE', other.id, { name: 'Dot' })
    graph.createNode('RECTANGLE', other.id, { name: 'Only in Pill' })
    const dotCopy = instanceLayerId(instance.id, [nested.id, dot.id])
    graph.updateNode(dotCopy, { visible: false })
    recordInstanceOverride(graph, dotCopy, ['visible'])

    graph.swapInstanceComponent(instanceLayerId(instance.id, [nested.id]), other.id)

    const state = instance.instanceOverrides
    expect(getInstanceOverride(state, [nested.id], 'componentId')).toBe(other.id)
    expect(getInstanceOverride(state, [nested.id, otherDot.id], 'visible')).toBe(true)
    expect(getInstanceOverride(state, [nested.id, dot.id], 'visible')).toBeUndefined()
    const swapped = required(graph.getNode(instanceLayerId(instance.id, [nested.id, otherDot.id])))
    expect(instanceLayerSource(graph, swapped)?.id).toBe(otherDot.id)
  })
})

describe('cloning and detaching', () => {
  test('a cloned instance names its copies after itself', () => {
    const { graph, page, rect, nested, dot, instance } = kit()
    const clone = required(graph.cloneTree(instance.id, page))
    expect(graph.getNode(instanceLayerId(clone.id, [rect.id]))).toBeDefined()
    expect(graph.getNode(instanceLayerId(clone.id, [nested.id, dot.id]))).toBeDefined()
  })

  test('detaching gives the layers ids of their own and makes nested instances owners', () => {
    const { graph, rect, nested, dot, badge, instance } = kit()
    const dotCopy = instanceLayerId(instance.id, [nested.id, dot.id])
    graph.updateNode(dotCopy, { opacity: 0.5 })
    recordInstanceOverride(graph, dotCopy, ['opacity'])

    const frame = required(graph.detachInstance(instance.id))

    expect(frame.type).toBe('FRAME')
    expect(graph.getNode(instanceLayerId(instance.id, [rect.id]))).toBeUndefined()
    const children = graph.getChildren(frame.id)
    expect(children.some((child) => parseInstanceLayerId(child.id))).toBe(false)
    const adopted = required(children.find((child) => child.type === 'INSTANCE'))
    expect(adopted.componentId).toBe(badge.id)
    const adoptedDot = required(graph.getNode(instanceLayerId(adopted.id, [dot.id])))
    expect(adoptedDot.opacity).toBe(0.5)
    expect(getInstanceOverride(adopted.instanceOverrides, [dot.id], 'opacity')).toBe(true)
  })

  test('migrating a graph already in this shape keeps its nested copies indexed', () => {
    const { graph, badge, nested, instance } = kit()
    migrateInstanceLayers(graph)
    expect(graph.getInstances(badge.id).map((node) => node.id)).toContain(
      instanceLayerId(instance.id, [nested.id])
    )
  })

  test('detaching a nested copy detaches the instances it sits in first', () => {
    const { graph, nested, instance } = kit()
    const detached = required(graph.detachInstance(instanceLayerId(instance.id, [nested.id])))
    expect(detached.type).toBe('FRAME')
    expect(graph.getNode(instance.id)?.type).toBe('FRAME')
  })
})

describe('renaming nodes', () => {
  test('keeps the nodes and their tree under new ids and reports it as delete then create', () => {
    const { graph, frame, label } = kit()
    const [frameId, labelId] = [frame.id, label.id]
    const events: string[] = []
    graph.onNodeEvents({
      deleted: (id) => events.push(`deleted ${id}`),
      created: (node) => events.push(`created ${node.id}`)
    })
    graph.renameNodes(
      new Map([
        [frameId, 'frame'],
        [labelId, 'label']
      ])
    )
    expect(graph.getNode('frame')).toBe(frame)
    expect(frame.childIds).toEqual(['label'])
    expect(graph.getNode('label')?.parentId).toBe('frame')
    expect(graph.getNode(frameId)).toBeUndefined()
    expect(events).toEqual([
      `deleted ${labelId}`,
      `deleted ${frameId}`,
      'created frame',
      'created label'
    ])
  })
})
