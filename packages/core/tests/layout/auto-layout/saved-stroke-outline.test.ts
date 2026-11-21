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

  test('is dropped when a pathless frame expands after layout flattened it', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      width: 100,
      height: 100,
      strokes: [INSIDE],
      strokeAlign: 'INSIDE',
      strokeWeight: 1,
      strokeGeometry: [OUTLINE]
    })

    graph.withLayoutMutations(() => {
      graph.updateNode(frame.id, { width: 0, height: 0 })
    })
    expect(frame.strokeGeometry).toEqual([OUTLINE])

    graph.withLayoutMutations(() => {
      graph.updateNode(frame.id, { width: 200, height: 200 })
    })

    expect([frame.width, frame.height]).toEqual([200, 200])
    expect(frame.strokeGeometry).toEqual([])
    expect(frame.source.editedFields).toContain('strokeGeometry')
  })

  test('scales a childless boolean fill when layout expands it from nothing', () => {
    const graph = new SceneGraph()
    const boolean = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
      width: 100,
      height: 100,
      fillGeometry: [span(100, 100)]
    })

    graph.withLayoutMutations(() => {
      graph.updateNode(boolean.id, { width: 0, height: 0 })
    })
    expect(endpoint(boolean.fillGeometry[0])).toEqual([100, 100])

    graph.withLayoutMutations(() => {
      graph.updateNode(boolean.id, { width: 200, height: 200 })
    })

    expect([boolean.width, boolean.height]).toEqual([200, 200])
    expect(endpoint(boolean.fillGeometry[0])).toEqual([200, 200])
  })

  test('scales a fill whose curve follows a close from the contour start', () => {
    const graph = new SceneGraph()
    const boolean = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
      width: 100,
      height: 100,
      fillGeometry: [closedThenCubic()]
    })

    graph.withLayoutMutations(() => {
      graph.updateNode(boolean.id, { width: 0, height: 0 })
    })
    expect(endpoint(boolean.fillGeometry[0])).toEqual([100, 100])

    graph.withLayoutMutations(() => {
      graph.updateNode(boolean.id, { width: 200, height: 200 })
    })

    expect([boolean.width, boolean.height]).toEqual([200, 200])
    expect(endpoint(boolean.fillGeometry[0])).toEqual([200, 200])
  })
})

/** A move to the origin and a line to (`x`, `y`). */
function span(x: number, y: number) {
  const commandsBlob = new Uint8Array(18)
  const view = new DataView(commandsBlob.buffer)
  commandsBlob[0] = 1
  commandsBlob[9] = 2
  view.setFloat32(10, x, true)
  view.setFloat32(14, y, true)
  return { windingRule: 'NONZERO' as const, commandsBlob }
}

/**
 * `M 0 0 L 100 100 Z C 400/3 10 400/3 20 0 30 Z`. Close returns the pen to (0, 0), so the curve
 * peaks at x = 100. Starting it at the line's end instead peaks near x = 118.5.
 */
function closedThenCubic() {
  const commandsBlob = new Uint8Array(45)
  const view = new DataView(commandsBlob.buffer)
  let offset = 0
  const command = (code: number) => {
    commandsBlob[offset] = code
    offset += 1
  }
  const pair = (x: number, y: number) => {
    view.setFloat32(offset, x, true)
    view.setFloat32(offset + 4, y, true)
    offset += 8
  }
  command(1)
  pair(0, 0)
  command(2)
  pair(100, 100)
  command(0)
  command(4)
  pair(400 / 3, 10)
  pair(400 / 3, 20)
  pair(0, 30)
  command(0)
  return { windingRule: 'NONZERO' as const, commandsBlob }
}

function endpoint(path: { commandsBlob: Uint8Array } | undefined): [number, number] {
  const blob = path?.commandsBlob
  if (!blob) throw new Error('Expected saved fill geometry')
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  return [view.getFloat32(10, true), view.getFloat32(14, true)]
}
