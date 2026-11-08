import { describe, expect, test } from 'bun:test'

import {
  constraintFrame,
  constraintLayers,
  isConstraintEligible,
  sharedConstraint
} from '@open-pencil/scene-graph/constraints'
import { createRect, firstPageId, makeSceneGraph } from '@open-pencil/test-support/scene'

describe('which layers follow constraints', () => {
  test('frame children outside auto layout flow, but not top-level layers or section children', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const topLevel = createRect(graph, pageId)
    const frame = graph.createNode('FRAME', pageId, { layoutMode: 'NONE' })
    const child = createRect(graph, frame.id)
    const section = graph.createNode('SECTION', pageId)
    const inSection = createRect(graph, section.id)
    expect(isConstraintEligible(graph, topLevel)).toBe(false)
    expect(isConstraintEligible(graph, child)).toBe(true)
    expect(isConstraintEligible(graph, inSection)).toBe(false)

    graph.updateNode(frame.id, { layoutMode: 'HORIZONTAL' })
    expect(isConstraintEligible(graph, child)).toBe(false)
    graph.updateNode(child.id, { layoutPositioning: 'ABSOLUTE' })
    expect(isConstraintEligible(graph, child)).toBe(true)
  })

  // Live Figma, 2026-11-08: groups and booleans own no constraints; their layers pin to the frame.
  test('a group, a boolean, and the layers in them pin to the frame around them', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const frame = graph.createNode('FRAME', pageId)
    const group = graph.createNode('GROUP', frame.id)
    const boolean = graph.createNode('BOOLEAN_OPERATION', group.id)
    const operand = createRect(graph, boolean.id)
    for (const node of [group, boolean, operand]) {
      expect(constraintFrame(graph, node)?.id).toBe(frame.id)
    }

    const loose = graph.createNode('GROUP', pageId)
    expect(isConstraintEligible(graph, createRect(graph, loose.id))).toBe(false)
    const section = graph.createNode('SECTION', pageId)
    expect(isConstraintEligible(graph, graph.createNode('GROUP', section.id))).toBe(false)
  })

  test('a group in an auto layout flow is placed by the layout, its layers too', () => {
    const graph = makeSceneGraph()
    const frame = graph.createNode('FRAME', firstPageId(graph), { layoutMode: 'VERTICAL' })
    const group = graph.createNode('GROUP', frame.id)
    const layer = createRect(graph, group.id)
    expect(isConstraintEligible(graph, layer)).toBe(false)
    graph.updateNode(group.id, { layoutPositioning: 'ABSOLUTE' })
    expect(isConstraintEligible(graph, layer)).toBe(true)
  })
})

describe("a group's constraints", () => {
  test('are those of the layers in it, through nested groups', () => {
    const graph = makeSceneGraph()
    const frame = graph.createNode('FRAME', firstPageId(graph))
    const group = graph.createNode('GROUP', frame.id)
    const a = createRect(graph, group.id)
    const inner = graph.createNode('GROUP', group.id)
    const b = createRect(graph, inner.id)
    expect(constraintLayers(graph, group).map((layer) => layer.id)).toEqual([a.id, b.id])
    expect(constraintLayers(graph, a)).toEqual([a])
  })

  test('show one value only when every layer has it', () => {
    const graph = makeSceneGraph()
    const frame = graph.createNode('FRAME', firstPageId(graph))
    const a = createRect(graph, frame.id)
    const b = graph.createNode('RECTANGLE', frame.id, { horizontalConstraint: 'MAX' })
    expect(sharedConstraint([a, b], 'verticalConstraint')).toBe('MIN')
    expect(sharedConstraint([a, b], 'horizontalConstraint')).toBeNull()
    expect(sharedConstraint([], 'horizontalConstraint')).toBeNull()
  })
})
