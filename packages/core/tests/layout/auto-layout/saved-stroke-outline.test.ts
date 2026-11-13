import { afterEach, describe, expect, test } from 'bun:test'

import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core/layout'
import { effectiveFigmaRawNodeFields } from '@open-pencil/fig'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const SHORT = 'iOS'
const LONG = 'In Entwicklung · Warteliste'
const OUTLINE = { windingRule: 'NONZERO' as const, commandsBlob: new Uint8Array([1, 2, 3, 4]) }

const INSIDE = {
  type: 'SOLID' as const,
  color: { r: 0, g: 0, b: 1, a: 1 },
  opacity: 1,
  visible: true,
  weight: 1,
  align: 'INSIDE' as const
}

/** 38 px for the short label, 226 px once it grows. One line, 20 px tall. */
function measureByLabel() {
  setTextMeasurer((node) => ({
    width: node.text === LONG ? 226 : 38,
    height: 20
  }))
}

afterEach(() => setTextMeasurer(null))

/**
 * A Badge component with a baked inside-stroke outline, nested in a ProductCard, then instanced.
 * A `.fig` stores that outline on the nested instance, and cloning the card copies it along.
 */
function nestedBadge() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const badge = graph.createNode('COMPONENT', page, {
    name: 'Badge',
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    width: 38,
    height: 20,
    strokes: [INSIDE],
    strokeAlign: 'INSIDE',
    strokeWeight: 1,
    strokeGeometry: [OUTLINE]
  })
  graph.createNode('TEXT', badge.id, {
    text: SHORT,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    width: 38,
    height: 20
  })
  const card = graph.createNode('COMPONENT', page, {
    name: 'ProductCard',
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    width: 38,
    height: 20
  })
  const nested = expectDefined(graph.createInstance(badge.id, card.id))
  graph.updateNode(nested.id, { strokeGeometry: [OUTLINE], width: 38, height: 20 })
  const instance = expectDefined(graph.createInstance(card.id, page))
  const clone = expectDefined(
    graph.getChildren(instance.id).find((node) => node.type === 'INSTANCE')
  )
  const label = expectDefined(graph.getChildren(clone.id).find((node) => node.type === 'TEXT'))
  return { graph, badge, clone, label }
}

function grow(graph: SceneGraph, label: SceneNode) {
  graph.updateNode(label.id, { text: LONG })
  computeAllLayouts(graph)
}

describe('a saved inside-stroke outline on a nested instance', () => {
  test('is dropped once layout grows the instance past the component', () => {
    measureByLabel()
    const { graph, badge, clone, label } = nestedBadge()

    computeAllLayouts(graph)
    expect(clone.width).toBe(38)
    expect(clone.strokeGeometry).toEqual([OUTLINE])

    grow(graph, label)

    expect(clone.width).toBe(226)
    expect(clone.height).toBe(20)
    expect(clone.strokeGeometry).toEqual([])
    expect(graph.getNode(badge.id)?.strokeGeometry).toEqual([OUTLINE])
    expect(clone.source.editedFields).toContain('strokeGeometry')
  })

  test('stays while derived layout is applying the size a file already stored', () => {
    measureByLabel()
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      width: 100,
      height: 40,
      strokes: [INSIDE],
      strokeGeometry: [OUTLINE]
    })
    frame.source.format = 'fig'
    frame.source.id = '1:2'
    frame.source.fig.rawNodeFields.strokeGeometry = [{ windingRule: 'NONZERO' }]
    graph.createNode('TEXT', frame.id, {
      text: SHORT,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      width: 38,
      height: 20
    })

    graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))

    const laidOut = expectDefined(graph.getNode(frame.id))
    expect(laidOut.width).toBe(38)
    expect(laidOut.strokeGeometry).toEqual([OUTLINE])
    expect(laidOut.source.editedFields).toEqual([])
    expect(effectiveFigmaRawNodeFields(laidOut).strokeGeometry).toEqual([
      { windingRule: 'NONZERO' }
    ])
  })
})
