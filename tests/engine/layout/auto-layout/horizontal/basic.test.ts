import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, computeLayout, createEditor, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('horizontal basic', () => {
  test('positions children left-to-right', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph))
    rect(graph, frame.id, 80, 40)
    rect(graph, frame.id, 60, 40)
    rect(graph, frame.id, 100, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(80)
    expect(children[2].x).toBe(140)
  })

  test('applies item spacing', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), { itemSpacing: 10 })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(60)
    expect(children[2].x).toBe(120)
  })

  test('applies padding', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      paddingTop: 10,
      paddingRight: 20,
      paddingBottom: 30,
      paddingLeft: 40
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.x).toBe(40)
    expect(child.y).toBe(10)
  })

  test('applies padding and spacing together', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      paddingLeft: 20,
      paddingTop: 15,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 30)
    rect(graph, frame.id, 50, 30)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(20)
    expect(children[0].y).toBe(15)
    expect(children[1].x).toBe(80)
    expect(children[1].y).toBe(15)
  })

  test('positions children right-to-left when layoutDirection is RTL', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 80,
      layoutDirection: 'RTL',
      paddingLeft: 20,
      paddingRight: 30,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 30)
    rect(graph, frame.id, 60, 30)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(220)
    expect(children[1].x).toBe(150)
  })

  test('inherits RTL flow when layoutDirection is AUTO inside an RTL parent', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 320,
      height: 120,
      layoutDirection: 'RTL'
    })
    const inner = autoFrame(graph, outer.id, {
      width: 240,
      height: 80,
      layoutDirection: 'AUTO'
    })
    rect(graph, inner.id, 50, 30)
    rect(graph, inner.id, 60, 30)

    computeAllLayouts(graph, outer.id)

    const children = graph.getChildren(inner.id)
    expect(children[0].x).toBe(190)
    expect(children[1].x).toBe(130)
  })

  test('allows nested frame to override parent flow direction', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 320,
      height: 120,
      layoutDirection: 'LTR'
    })
    const inner = autoFrame(graph, outer.id, {
      width: 240,
      height: 80,
      layoutDirection: 'RTL'
    })
    rect(graph, inner.id, 50, 30)
    rect(graph, inner.id, 60, 30)

    computeAllLayouts(graph, outer.id)

    const children = graph.getChildren(inner.id)
    expect(children[0].x).toBe(190)
    expect(children[1].x).toBe(130)
  })

  test('recomputes deep auto descendants when parent flow changes', () => {
    const graph = new SceneGraph()
    const outer = graph.createNode('FRAME', pageId(graph), {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 320,
      height: 200,
      layoutDirection: 'LTR'
    })
    const wrapper = graph.createNode('FRAME', outer.id, {
      layoutMode: 'NONE',
      width: 280,
      height: 120
    })
    const inner = autoFrame(graph, wrapper.id, {
      width: 240,
      height: 80,
      layoutDirection: 'AUTO'
    })
    rect(graph, inner.id, 50, 30)
    rect(graph, inner.id, 60, 30)

    const editor = createEditor({ graph })
    editor.updateNodeWithUndo(outer.id, { layoutDirection: 'RTL' }, 'Change layout direction')

    const children = graph.getChildren(inner.id)
    expect(children[0].x).toBe(190)
    expect(children[1].x).toBe(130)
  })
})
