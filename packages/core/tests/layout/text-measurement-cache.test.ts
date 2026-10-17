import { describe, expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import {
  clearTextMeasurements,
  installTextMeasurer,
  measureTextForLayout,
  withTextMeasurer
} from '#core/layout/text-measurement'

/** A text node with the fields a measurement reads. */
function textNode(graph: SceneGraph, overrides: Partial<SceneNode> = {}): SceneNode {
  const page = graph.getPages()[0]
  return graph.createNode('TEXT', page.id, {
    text: 'Ver ficha',
    fontSize: 14,
    width: 100,
    height: 20,
    ...overrides
  })
}

/** Runs `body` with a fresh cache and a measurer that counts how often it actually runs. */
function withCountingMeasurer<T>(body: (calls: () => number) => T): T {
  const counts = { calls: 0 }
  const restore = installTextMeasurer(() => {
    counts.calls += 1
    return { width: 10, height: 10 }
  })
  clearTextMeasurements()
  try {
    return body(() => counts.calls)
  } finally {
    restore()
  }
}

/** A vertical frame whose text layers the layout has to shape, as an instance's clones are. */
function frameWithTextLayers(count: number): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, {
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    width: 200,
    height: 200
  })
  for (let index = 0; index < count; index += 1) {
    graph.createNode('TEXT', frame.id, {
      text: 'Ver ficha',
      fontSize: 14,
      width: 100,
      height: 20,
      // Without a resize mode the layout keeps the stored box and never shapes the text.
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
  }
  return graph
}

describe('the text measurement cache', () => {
  test('measures identical text once, however many nodes carry it', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      measureTextForLayout(textNode(graph))
      measureTextForLayout(textNode(graph))

      expect(calls()).toBe(1)
    })
  })

  test('measures again when the text differs', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      measureTextForLayout(textNode(graph))
      measureTextForLayout(textNode(graph, { text: 'Otra etiqueta' }))

      expect(calls()).toBe(2)
    })
  })

  test('measures again when the box differs, because the paragraph is laid out at its width', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      measureTextForLayout(textNode(graph))
      measureTextForLayout(textNode(graph, { width: 240 }))

      expect(calls()).toBe(2)
    })
  })

  test('measures again when the constraint differs', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      const node = textNode(graph)
      measureTextForLayout(node, 80)
      measureTextForLayout(node, 120)

      expect(calls()).toBe(2)
    })
  })

  test('measures again when the fonts change, since every cached size is stale', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      const node = textNode(graph)
      measureTextForLayout(node)
      clearTextMeasurements()
      measureTextForLayout(node)

      expect(calls()).toBe(2)
    })
  })

  test('measures again when a run of the text carries its own style', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      measureTextForLayout(textNode(graph))
      measureTextForLayout(
        textNode(graph, {
          styleRuns: [{ start: 0, length: 4, style: { fontWeight: 700 } }]
        })
      )

      // Shaped bold text is a different shape, so a plain run's size cannot answer for it.
      expect(calls()).toBe(2)
    })
  })

  test('measures again when a paragraph setting differs, because spacing changes the height', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      measureTextForLayout(textNode(graph))
      measureTextForLayout(textNode(graph, { paragraphSpacing: 8 }))

      expect(calls()).toBe(2)
    })
  })

  test('does not let a delimiter inside a value imitate the field boundary', () => {
    const graph = new SceneGraph()
    withCountingMeasurer((calls) => {
      // Joined with a NUL, these two read as the same key unless the value's own NUL is escaped.
      measureTextForLayout(textNode(graph, { text: 'A\u0000B', fontFamily: 'C' }))
      measureTextForLayout(textNode(graph, { text: 'A', fontFamily: 'B\u0000C' }))

      expect(calls()).toBe(2)
    })
  })

  test('answers a temporary measurer with its own sizes, never the installed one’s', () => {
    const graph = new SceneGraph()
    const node = textNode(graph)
    const restore = installTextMeasurer(() => ({ width: 10, height: 10 }))
    clearTextMeasurements()
    try {
      expect(measureTextForLayout(node).width).toBe(10)

      const swapped = withTextMeasurer(
        () => ({ width: 20, height: 10 }),
        () => measureTextForLayout(node)
      )

      expect(swapped.width).toBe(20)
      // The installed measurer's own answer is still its own once the override is over.
      expect(measureTextForLayout(node).width).toBe(10)
    } finally {
      restore()
    }
  })

  test('keeps each temporary measurer’s sizes out of the next one’s way', () => {
    const graph = new SceneGraph()
    const node = textNode(graph)
    clearTextMeasurements()

    const first = withTextMeasurer(
      () => ({ width: 30, height: 10 }),
      () => measureTextForLayout(node).width
    )
    const second = withTextMeasurer(
      () => ({ width: 40, height: 10 }),
      () => measureTextForLayout(node).width
    )

    expect([first, second]).toEqual([30, 40])
  })

  test('estimates when no measurer is installed, rather than caching nothing', () => {
    const graph = new SceneGraph()
    clearTextMeasurements()
    const size = measureTextForLayout(textNode(graph))

    expect(size.height).toBeGreaterThan(0)
  })
})

describe('laying out a frame of repeated text', () => {
  test('shapes each distinct text once, however many layers carry it', () => {
    const measurements = (count: number) =>
      withCountingMeasurer((calls) => {
        computeAllLayouts(frameWithTextLayers(count))
        return calls()
      })

    expect([measurements(1), measurements(2)]).toEqual([1, 1])
  })
})
