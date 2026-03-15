import { describe, test, expect } from 'bun:test'

import { SceneGraph, type SceneNode, type GridTrack, computeLayout, computeAllLayouts, setTextMeasurer, FigmaAPI } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function autoFrame(
  graph: SceneGraph,
  parentId: string,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('FRAME', parentId, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    width: 400,
    height: 200,
    ...overrides,
  })
}

function rect(
  graph: SceneGraph,
  parentId: string,
  w = 50,
  h = 50,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('RECTANGLE', parentId, {
    name: 'Rect',
    width: w,
    height: h,
    ...overrides,
  })
}

describe('Auto Layout', () => {
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
        paddingLeft: 40,
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
        itemSpacing: 10,
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
  })

  describe('vertical basic', () => {
    test('positions children top-to-bottom', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
      })
      rect(graph, frame.id, 50, 80)
      rect(graph, frame.id, 50, 60)
      rect(graph, frame.id, 50, 100)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(0)
      expect(children[1].y).toBe(80)
      expect(children[2].y).toBe(140)
    })

    test('applies item spacing vertically', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
        itemSpacing: 16,
      })
      rect(graph, frame.id, 50, 40)
      rect(graph, frame.id, 50, 40)
      rect(graph, frame.id, 50, 40)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(0)
      expect(children[1].y).toBe(56)
      expect(children[2].y).toBe(112)
    })
  })

  describe('alignment - primary axis', () => {
    test('center alignment (horizontal)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
        primaryAxisAlign: 'CENTER',
      })
      rect(graph, frame.id, 100, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.x).toBe(150)
    })

    test('max alignment (horizontal)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
        primaryAxisAlign: 'MAX',
      })
      rect(graph, frame.id, 100, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.x).toBe(300)
    })

    test('space-between alignment (horizontal)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
        primaryAxisAlign: 'SPACE_BETWEEN',
      })
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[2].x).toBe(350)
      expect(children[1].x).toBeCloseTo(175, 0)
    })

    test('center alignment (vertical)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
        primaryAxisAlign: 'CENTER',
      })
      rect(graph, frame.id, 50, 100)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.y).toBe(150)
    })

    test('max alignment (vertical)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
        primaryAxisAlign: 'MAX',
      })
      rect(graph, frame.id, 50, 100)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.y).toBe(300)
    })
  })

  describe('alignment - counter axis', () => {
    test('center cross-axis alignment (horizontal)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        counterAxisAlign: 'CENTER',
      })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.y).toBe(75)
    })

    test('max cross-axis alignment (horizontal)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        counterAxisAlign: 'MAX',
      })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.y).toBe(150)
    })

    test('center cross-axis alignment (vertical)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
        counterAxisAlign: 'CENTER',
      })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.x).toBe(75)
    })

    test('stretch cross-axis alignment (horizontal)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        counterAxisAlign: 'STRETCH',
      })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.height).toBe(200)
    })

    test('stretch cross-axis alignment (vertical)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
        counterAxisAlign: 'STRETCH',
      })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.width).toBe(200)
    })
  })

  describe('sizing modes', () => {
    test('hug contents horizontally', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'FIXED',
        width: 999,
        height: 100,
        itemSpacing: 10,
      })
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 70, 50)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(130)
    })

    test('hug contents vertically', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'FIXED',
        width: 200,
        height: 999,
        itemSpacing: 10,
      })
      rect(graph, frame.id, 50, 40)
      rect(graph, frame.id, 50, 60)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.height).toBe(110)
    })

    test('hug includes padding', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        width: 999,
        height: 999,
        paddingTop: 10,
        paddingRight: 20,
        paddingBottom: 30,
        paddingLeft: 40,
      })
      rect(graph, frame.id, 100, 50)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(160)
      expect(f.height).toBe(90)
    })

    test('child fill in horizontal layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
      })
      rect(graph, frame.id, 100, 50)
      rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(100)
      expect(children[1].width).toBe(300)
    })

    test('child fill in vertical layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
      })
      rect(graph, frame.id, 50, 100)
      rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].height).toBe(100)
      expect(children[1].height).toBe(300)
    })

    test('multiple fill children share space equally', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 300,
        height: 100,
      })
      rect(graph, frame.id, 50, 50, { layoutGrow: 1 })
      rect(graph, frame.id, 50, 50, { layoutGrow: 1 })
      rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(100)
      expect(children[1].width).toBe(100)
      expect(children[2].width).toBe(100)
    })

    test('fill with spacing and padding', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
        paddingLeft: 20,
        paddingRight: 20,
        itemSpacing: 10,
      })
      rect(graph, frame.id, 100, 50)
      rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(100)
      // 400 - 20 - 20 (padding) - 100 (fixed child) - 10 (spacing) = 250
      expect(children[1].width).toBe(250)
    })
  })

  describe('absolute positioning', () => {
    test('absolute children are skipped in layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        itemSpacing: 10,
      })
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50, {
        layoutPositioning: 'ABSOLUTE',
        x: 200,
        y: 100,
      })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // First auto child at 0
      expect(children[0].x).toBe(0)
      // Absolute child should keep its position
      expect(children[1].x).toBe(200)
      expect(children[1].y).toBe(100)
      // Third child should be right after first (no gap for absolute)
      expect(children[2].x).toBe(60)
    })
  })

  describe('hidden children', () => {
    test('hidden children preserve original size but collapse in layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 300,
        height: 100,
        itemSpacing: 10,
      })
      rect(graph, frame.id, 50, 50, { visible: false })
      rect(graph, frame.id, 80, 40)
      rect(graph, frame.id, 50, 50, { visible: false })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(50)
      expect(children[0].height).toBe(50)
      expect(children[1].x).toBe(0)
      expect(children[1].width).toBe(80)
      expect(children[2].width).toBe(50)
      expect(children[2].height).toBe(50)
    })

    test('hidden children do not consume spacing', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
        itemSpacing: 20,
      })
      rect(graph, frame.id, 50, 50, { visible: false })
      rect(graph, frame.id, 100, 50)
      rect(graph, frame.id, 100, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[1].x).toBe(0)
      expect(children[2].x).toBe(120)
    })

    test('hug frame ignores hidden children for sizing', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
      })
      rect(graph, frame.id, 200, 200, { visible: false })
      rect(graph, frame.id, 50, 30)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(50)
      expect(f.height).toBe(30)
    })

    test('hidden nested auto-layout children preserve size but collapse in layout', () => {
      const graph = new SceneGraph()
      const outer = autoFrame(graph, pageId(graph), {
        width: 300,
        height: 100,
        itemSpacing: 16,
      })
      const inner = autoFrame(graph, outer.id, {
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        width: 50,
        height: 50,
        visible: false,
      })
      rect(graph, inner.id, 30, 30)
      rect(graph, outer.id, 80, 40)

      computeLayout(graph, outer.id)

      const children = graph.getChildren(outer.id)
      const innerNode = graph.getNode(inner.id)!
      expect(innerNode.width).toBe(50)
      expect(innerNode.height).toBe(50)
      expect(children[1].x).toBe(0)
    })
  })

  describe('self-alignment', () => {
    test('layoutAlignSelf STRETCH overrides counter axis', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        counterAxisAlign: 'MIN',
      })
      rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'STRETCH' })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].height).toBe(200)
      expect(children[1].height).toBe(50)
    })
  })

  describe('nested auto layout', () => {
    test('nested horizontal frames', () => {
      const graph = new SceneGraph()
      const outer = autoFrame(graph, pageId(graph), {
        width: 500,
        height: 200,
        itemSpacing: 10,
      })
      const inner = autoFrame(graph, outer.id, {
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'FIXED',
        width: 999,
        height: 100,
        itemSpacing: 5,
      })
      rect(graph, inner.id, 40, 40)
      rect(graph, inner.id, 60, 40)
      rect(graph, outer.id, 80, 80)

      computeLayout(graph, outer.id)

      const innerNode = graph.getNode(inner.id)!
      expect(innerNode.width).toBe(105)
      expect(innerNode.x).toBe(0)

      const outerChildren = graph.getChildren(outer.id)
      expect(outerChildren[1].x).toBe(115)
    })

    test('nested vertical inside horizontal', () => {
      const graph = new SceneGraph()
      const outer = autoFrame(graph, pageId(graph), {
        width: 500,
        height: 300,
        itemSpacing: 20,
      })
      const inner = autoFrame(graph, outer.id, {
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'FIXED',
        width: 100,
        height: 999,
        itemSpacing: 10,
      })
      rect(graph, inner.id, 80, 50)
      rect(graph, inner.id, 80, 70)
      rect(graph, outer.id, 60, 60)

      computeLayout(graph, outer.id)

      const innerNode = graph.getNode(inner.id)!
      expect(innerNode.height).toBe(130)

      const outerChildren = graph.getChildren(outer.id)
      expect(outerChildren[0].x).toBe(0)
      expect(outerChildren[1].x).toBe(120)
    })

    test('computeAllLayouts handles deeply nested frames', () => {
      const graph = new SceneGraph()
      const page = pageId(graph)
      const outer = autoFrame(graph, page, {
        layoutMode: 'VERTICAL',
        width: 300,
        height: 500,
        itemSpacing: 10,
      })
      const middle = autoFrame(graph, outer.id, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        width: 999,
        height: 999,
        itemSpacing: 5,
      })
      rect(graph, middle.id, 40, 30)
      rect(graph, middle.id, 60, 30)
      rect(graph, outer.id, 100, 50)

      computeAllLayouts(graph)

      const middleNode = graph.getNode(middle.id)!
      expect(middleNode.width).toBe(105)
      expect(middleNode.height).toBe(30)

      const outerChildren = graph.getChildren(outer.id)
      expect(outerChildren[0].y).toBe(0)
      expect(outerChildren[1].y).toBe(40)
    })
  })

  describe('wrap layout', () => {
    test('wraps children in horizontal layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 300,
        layoutWrap: 'WRAP',
      })
      rect(graph, frame.id, 80, 40)
      rect(graph, frame.id, 80, 40)
      rect(graph, frame.id, 80, 40)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // First two fit on first row (80 + 80 = 160 <= 200)
      expect(children[0].x).toBe(0)
      expect(children[0].y).toBe(0)
      expect(children[1].x).toBe(80)
      expect(children[1].y).toBe(0)
      // Third wraps to second row
      expect(children[2].x).toBe(0)
      expect(children[2].y).toBe(40)
    })

    test('counterAxisSpacing adds gap between wrapped rows', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 300,
        layoutWrap: 'WRAP',
        counterAxisSpacing: 10,
      })
      rect(graph, frame.id, 120, 40)
      rect(graph, frame.id, 120, 40)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(0)
      expect(children[1].y).toBe(50)
    })

    test('itemSpacing with wrap', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 300,
        layoutWrap: 'WRAP',
        itemSpacing: 10,
      })
      // 90 + 10 + 90 = 190, fits in 200
      rect(graph, frame.id, 90, 40)
      rect(graph, frame.id, 90, 40)
      // 90 wraps to next row
      rect(graph, frame.id, 90, 40)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(100)
      expect(children[2].x).toBe(0)
      expect(children[2].y).toBe(40)
    })
  })

  describe('counter axis spacing (no wrap)', () => {
    test('counterAxisSpacing is ignored without wrap in horizontal', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 300,
        height: 100,
        counterAxisSpacing: 50,
        layoutWrap: 'NO_WRAP',
      })
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // Without wrap, counterAxisSpacing has no effect
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(50)
    })
  })

  describe('layout mode NONE', () => {
    test('computeLayout does nothing for NONE layout', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Plain',
        layoutMode: 'NONE',
        width: 400,
        height: 200,
      })
      const child = rect(graph, frame.id, 50, 50, { x: 100, y: 100 })

      computeLayout(graph, frame.id)

      const c = graph.getNode(child.id)!
      expect(c.x).toBe(100)
      expect(c.y).toBe(100)
    })
  })

  describe('edge cases', () => {
    test('empty auto layout frame', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        paddingTop: 10,
        paddingRight: 20,
        paddingBottom: 30,
        paddingLeft: 40,
      })

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(60)
      expect(f.height).toBe(40)
    })

    test('single child', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 100,
      })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.x).toBe(0)
      expect(child.y).toBe(0)
      expect(child.width).toBe(50)
      expect(child.height).toBe(50)
    })

    test('all children absolute → frame hugs to padding only', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        paddingTop: 5,
        paddingRight: 5,
        paddingBottom: 5,
        paddingLeft: 5,
      })
      rect(graph, frame.id, 100, 100, { layoutPositioning: 'ABSOLUTE' })

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(10)
      expect(f.height).toBe(10)
    })

    test('zero-size children', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
      })
      rect(graph, frame.id, 0, 0)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(50)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(0)
    })
  })

  describe('mixed sizing', () => {
    test('fixed primary, hug counter (horizontal)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 999,
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'HUG',
      })
      rect(graph, frame.id, 50, 80)
      rect(graph, frame.id, 50, 120)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(400)
      expect(f.height).toBe(120)
    })

    test('hug primary, fixed counter (vertical)', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 999,
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'FIXED',
        itemSpacing: 10,
      })
      rect(graph, frame.id, 50, 40)
      rect(graph, frame.id, 80, 60)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.height).toBe(110)
      expect(f.width).toBe(200)
    })
  })

  describe('nested auto layout with fill children', () => {
    test('child frame with FILL sizing expands in parent', () => {
      const graph = new SceneGraph()
      const outer = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        itemSpacing: 10,
      })
      rect(graph, outer.id, 100, 50)
      const inner = autoFrame(graph, outer.id, {
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        width: 50,
        height: 50,
        layoutGrow: 1,
      })
      rect(graph, inner.id, 30, 30)

      computeLayout(graph, outer.id)

      const innerNode = graph.getNode(inner.id)!
      // 400 - 100 - 10 = 290
      expect(innerNode.width).toBe(290)
    })
  })

  describe('gap mapping correctness', () => {
    test('horizontal: itemSpacing is column gap, counterAxisSpacing is row gap', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 300,
        layoutWrap: 'WRAP',
        itemSpacing: 10,
        counterAxisSpacing: 20,
      })
      // Each row: 90 + 10 + 90 = 190 <= 200
      rect(graph, frame.id, 90, 40)
      rect(graph, frame.id, 90, 40)
      // These wrap
      rect(graph, frame.id, 90, 40)
      rect(graph, frame.id, 90, 40)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // Row 1
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(100)
      // Row 2: y = 40 (row height) + 20 (counterAxisSpacing) = 60
      expect(children[2].y).toBe(60)
      expect(children[3].x).toBe(100)
    })

    test('vertical: itemSpacing is row gap, counterAxisSpacing is column gap', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 300,
        height: 200,
        layoutWrap: 'WRAP',
        itemSpacing: 10,
        counterAxisSpacing: 20,
      })
      // Each column: 80 + 10 + 80 = 170 <= 200
      rect(graph, frame.id, 40, 80)
      rect(graph, frame.id, 40, 80)
      // These wrap to second column
      rect(graph, frame.id, 40, 80)
      rect(graph, frame.id, 40, 80)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // Column 1
      expect(children[0].y).toBe(0)
      expect(children[1].y).toBe(90)
      // Column 2: x = 40 (col width) + 20 (counterAxisSpacing) = 60
      expect(children[2].x).toBe(60)
      expect(children[2].y).toBe(0)
      expect(children[3].x).toBe(60)
      expect(children[3].y).toBe(90)
    })
  })

  describe('text measurement', () => {
    test('WIDTH_AND_HEIGHT text uses measured width in centered layout', () => {
      const graph = new SceneGraph()
      const pid = pageId(graph)

      const frame = autoFrame(graph, pid, {
        width: 300,
        height: 40,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        primaryAxisAlign: 'CENTER',
        paddingLeft: 10,
        paddingRight: 10,
        itemSpacing: 10,
      })

      const arrow1 = graph.createNode('FRAME', frame.id, { width: 20, height: 20 })
      const text = graph.createNode('TEXT', frame.id, {
        width: 200,
        height: 20,
        text: 'Test',
        fontSize: 14,
        textAutoResize: 'WIDTH_AND_HEIGHT' as const,
      })
      const arrow2 = graph.createNode('FRAME', frame.id, { width: 20, height: 20 })

      setTextMeasurer((node) => {
        if (node.type === 'TEXT' && node.textAutoResize === 'WIDTH_AND_HEIGHT') {
          return { width: 60, height: 20 }
        }
        return null
      })

      computeAllLayouts(graph)

      setTextMeasurer(null)

      const updatedText = graph.getNode(text.id)!
      const updatedArrow1 = graph.getNode(arrow1.id)!
      const updatedArrow2 = graph.getNode(arrow2.id)!

      expect(updatedText.width).toBe(60)

      // Total content: 10 + 20 + 10 + 60 + 10 + 20 + 10 = 140
      // Free space: 300 - 140 = 160, centered offset = 80
      expect(updatedArrow1.x).toBe(90)
      expect(updatedText.x).toBe(120)
      expect(updatedArrow2.x).toBe(190)
    })

    test('without measurer, text uses estimated size instead of 100x100 default', () => {
      const graph = new SceneGraph()
      const pid = pageId(graph)

      const frame = autoFrame(graph, pid, {
        width: 300,
        height: 40,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        primaryAxisAlign: 'CENTER',
      })

      graph.createNode('TEXT', frame.id, {
        width: 200,
        height: 20,
        text: 'Test',
        fontSize: 14,
        textAutoResize: 'WIDTH_AND_HEIGHT' as const,
      })

      setTextMeasurer(null)
      computeAllLayouts(graph)

      const children = graph.getChildren(frame.id)
      const updatedText = children[0]
      // Rough estimate: ~0.6 × fontSize × charCount, not the 100×100 default
      expect(updatedText.width).toBeLessThan(100)
      expect(updatedText.width).toBeGreaterThan(0)
      expect(updatedText.height).toBeLessThan(100)
      expect(updatedText.height).toBeGreaterThan(0)
    })

    test('without measurer, HEIGHT text estimates multi-line wrapping', () => {
      const graph = new SceneGraph()
      const pid = pageId(graph)

      const frame = autoFrame(graph, pid, {
        width: 269,
        height: 400,
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
      })

      graph.createNode('TEXT', frame.id, {
        width: 269,
        height: 20,
        text: 'GDP Growth Exceeds Expectations at 3.1% in Q2 Report That Nobody Expected',
        fontSize: 15,
        lineHeight: 22,
        textAutoResize: 'HEIGHT' as const,
      })

      setTextMeasurer(null)
      computeAllLayouts(graph)

      const children = graph.getChildren(frame.id)
      const updatedText = children[0]
      // 74 chars × 15 × 0.6 = 666px single line, in 269px → ~3 lines × 22px = 66px
      expect(updatedText.height).toBeGreaterThan(22)
      expect(updatedText.width).toBe(269)
    })

    test('text with w="fill" in flex="col" stretches to parent width', () => {
      const graph = new SceneGraph()
      const pid = pageId(graph)

      const frame = autoFrame(graph, pid, {
        width: 300,
        height: 400,
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        paddingLeft: 20,
        paddingRight: 20,
      })

      const text = graph.createNode('TEXT', frame.id, {
        width: 100,
        height: 20,
        text: 'This text should fill the parent width',
        fontSize: 14,
        textAutoResize: 'HEIGHT' as const,
        layoutAlignSelf: 'STRETCH' as const,
      })

      setTextMeasurer((_node, maxWidth) => {
        const w = maxWidth ?? 260
        return { width: w, height: 20 }
      })

      computeAllLayouts(graph)
      setTextMeasurer(null)

      const updatedText = graph.getNode(text.id)!
      // Should stretch to 300 - 20 - 20 = 260, NOT stay at 100
      expect(updatedText.width).toBe(260)
    })

    test('HEIGHT auto-resize text wraps via MeasureFunc when filling parent', () => {
      const graph = new SceneGraph()
      const pid = pageId(graph)

      const frame = autoFrame(graph, pid, {
        width: 300,
        height: 200,
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
      })

      const text = graph.createNode('TEXT', frame.id, {
        width: 300,
        height: 20,
        text: 'Long text that should wrap within the available width',
        fontSize: 14,
        textAutoResize: 'HEIGHT' as const,
      })

      setTextMeasurer((_node, maxWidth) => {
        const w = maxWidth ?? 1e6
        if (w >= 300) return { width: 300, height: 20 }
        return { width: w, height: 60 }
      })

      computeAllLayouts(graph)
      setTextMeasurer(null)

      const updatedText = graph.getNode(text.id)!
      expect(updatedText.width).toBe(300)
      expect(updatedText.height).toBe(20)
    })

    test('MeasureFunc receives constraint width from flex layout', () => {
      const graph = new SceneGraph()
      const pid = pageId(graph)

      const frame = autoFrame(graph, pid, {
        width: 400,
        height: 200,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        itemSpacing: 10,
      })

      rect(graph, frame.id, 100, 50)

      const text = graph.createNode('TEXT', frame.id, {
        width: 500,
        height: 20,
        text: 'Wide text',
        fontSize: 14,
        textAutoResize: 'WIDTH_AND_HEIGHT' as const,
        layoutGrow: 1,
      })

      const receivedWidths: number[] = []
      setTextMeasurer((_node, maxWidth) => {
        if (maxWidth !== undefined) receivedWidths.push(Math.round(maxWidth))
        const w = maxWidth ?? 500
        return { width: Math.min(200, w), height: w < 200 ? 40 : 20 }
      })

      computeAllLayouts(graph)
      setTextMeasurer(null)

      // 400 - 100 - 10 = 290 available for the fill text
      expect(receivedWidths.length).toBeGreaterThan(0)
      const updatedText = graph.getNode(text.id)!
      expect(updatedText.width).toBe(290)
    })

    test('textAutoResize NONE skips MeasureFunc', () => {
      const graph = new SceneGraph()
      const pid = pageId(graph)

      const frame = autoFrame(graph, pid, {
        width: 300,
        height: 100,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
      })

      const text = graph.createNode('TEXT', frame.id, {
        width: 150,
        height: 40,
        text: 'Fixed text',
        fontSize: 14,
        textAutoResize: 'NONE' as const,
      })

      let measureCalled = false
      setTextMeasurer(() => {
        measureCalled = true
        return { width: 80, height: 20 }
      })

      computeAllLayouts(graph)
      setTextMeasurer(null)

      expect(measureCalled).toBe(false)
      const updatedText = graph.getNode(text.id)!
      expect(updatedText.width).toBe(150)
      expect(updatedText.height).toBe(40)
    })
  })

  describe('min/max constraints', () => {
    test('maxWidth clamps child in horizontal layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
      })
      rect(graph, frame.id, 50, 50, { layoutGrow: 1, maxWidth: 200 })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.width).toBe(200)
    })

    test('minWidth prevents shrinking below minimum', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 100,
        height: 100,
      })
      rect(graph, frame.id, 200, 50, { minWidth: 150 })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.width).toBeGreaterThanOrEqual(150)
    })

    test('maxHeight clamps child in vertical layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
      })
      rect(graph, frame.id, 50, 50, { layoutGrow: 1, maxHeight: 150 })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.height).toBe(150)
    })

    test('minHeight enforces minimum in vertical layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 200,
        height: 400,
      })
      rect(graph, frame.id, 50, 30, { minHeight: 80 })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.height).toBe(80)
    })

    test('min/max on nested auto-layout frame', () => {
      const graph = new SceneGraph()
      const outer = autoFrame(graph, pageId(graph), {
        width: 500,
        height: 200,
      })
      const inner = autoFrame(graph, outer.id, {
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        width: 50,
        height: 50,
        layoutGrow: 1,
        maxWidth: 250,
      })
      rect(graph, inner.id, 30, 30)

      computeLayout(graph, outer.id)

      const innerNode = graph.getNode(inner.id)!
      expect(innerNode.width).toBe(250)
    })
  })

  describe('counterAxisAlignContent', () => {
    test('SPACE_BETWEEN distributes wrapped rows evenly', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 300,
        layoutWrap: 'WRAP',
        counterAxisAlignContent: 'SPACE_BETWEEN' as const,
      })
      rect(graph, frame.id, 120, 40)
      rect(graph, frame.id, 120, 40)
      rect(graph, frame.id, 120, 40)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // 3 rows of 40px each = 120px total, 300 - 120 = 180px free space
      // SPACE_BETWEEN: first row at 0, last row at 260
      expect(children[0].y).toBe(0)
      expect(children[2].y).toBe(260)
      // Middle row centered: (0 + 260) / 2 = 130
      expect(children[1].y).toBe(130)
    })

    test('AUTO (default) packs wrapped rows at start', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 300,
        layoutWrap: 'WRAP',
      })
      rect(graph, frame.id, 120, 40)
      rect(graph, frame.id, 120, 40)
      rect(graph, frame.id, 120, 40)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(0)
      expect(children[1].y).toBe(40)
      expect(children[2].y).toBe(80)
    })
  })

  describe('layoutAlignSelf extended values', () => {
    test('layoutAlignSelf CENTER positions child at cross-axis center', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        counterAxisAlign: 'MIN',
      })
      rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'CENTER' as const })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(75)
      expect(children[1].y).toBe(0)
    })

    test('layoutAlignSelf MAX positions child at cross-axis end', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        counterAxisAlign: 'MIN',
      })
      rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'MAX' as const })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(150)
      expect(children[1].y).toBe(0)
    })

    test('layoutAlignSelf MIN overrides parent STRETCH', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        counterAxisAlign: 'STRETCH',
      })
      rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'MIN' as const })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(0)
      expect(children[0].height).toBe(50)
      expect(children[1].height).toBe(200)
    })

    test('layoutAlignSelf in vertical layout', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        width: 300,
        height: 400,
        counterAxisAlign: 'MIN',
      })
      rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'CENTER' as const })
      rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'MAX' as const })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(125)
      expect(children[1].x).toBe(250)
    })
  })

  describe('FILL flexBasis', () => {
    test('FILL children with different content sizes get equal width', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 100,
      })

      const inner1 = autoFrame(graph, frame.id, {
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        width: 100,
        height: 50,
        layoutGrow: 1,
      })
      rect(graph, inner1.id, 100, 50)

      const inner2 = autoFrame(graph, frame.id, {
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        width: 200,
        height: 50,
        layoutGrow: 1,
      })
      rect(graph, inner2.id, 200, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(200)
      expect(children[1].width).toBe(200)
    })

    test('nested FILL children distribute from zero basis', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 300,
        height: 100,
        itemSpacing: 0,
      })
      autoFrame(graph, frame.id, {
        primaryAxisSizing: 'FILL' as const,
        counterAxisSizing: 'FIXED',
        width: 50,
        height: 100,
      })
      autoFrame(graph, frame.id, {
        primaryAxisSizing: 'FILL' as const,
        counterAxisSizing: 'FIXED',
        width: 50,
        height: 100,
      })
      autoFrame(graph, frame.id, {
        primaryAxisSizing: 'FILL' as const,
        counterAxisSizing: 'FIXED',
        width: 50,
        height: 100,
      })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(100)
      expect(children[1].width).toBe(100)
      expect(children[2].width).toBe(100)
    })
  })

  describe('hidden children preserve dimensions', () => {
    test('re-showing a hidden child restores original size', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 300,
        height: 100,
      })
      const child = rect(graph, frame.id, 80, 60)

      computeLayout(graph, frame.id)
      expect(graph.getNode(child.id)!.width).toBe(80)

      graph.updateNode(child.id, { visible: false })
      computeLayout(graph, frame.id)
      expect(graph.getNode(child.id)!.width).toBe(80)
      expect(graph.getNode(child.id)!.height).toBe(60)

      graph.updateNode(child.id, { visible: true })
      computeLayout(graph, frame.id)
      expect(graph.getNode(child.id)!.width).toBe(80)
      expect(graph.getNode(child.id)!.height).toBe(60)
    })
  })

  describe('absolute children in Yoga tree', () => {
    test('absolute children do not affect auto-layout flow', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
      })
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 100, 100, { layoutPositioning: 'ABSOLUTE', x: 300, y: 150 })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const f = graph.getNode(frame.id)!
      expect(f.width).toBe(100)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[2].x).toBe(50)

      expect(children[1].x).toBe(300)
      expect(children[1].y).toBe(150)
    })

    test('absolute children preserve position when parent resizes', () => {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 400,
        height: 200,
        itemSpacing: 10,
      })
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 80, 40, { layoutPositioning: 'ABSOLUTE', x: 200, y: 100 })

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(200)
      expect(children[1].y).toBe(100)
      expect(children[1].width).toBe(80)
      expect(children[1].height).toBe(40)
    })
  })
})

function gridFrame(
  graph: SceneGraph,
  parentId: string,
  columns: GridTrack[],
  rows: GridTrack[],
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('FRAME', parentId, {
    layoutMode: 'GRID',
    width: 400,
    height: 300,
    gridTemplateColumns: columns,
    gridTemplateRows: rows,
    gridColumnGap: 0,
    gridRowGap: 0,
    ...overrides,
  })
}

function fr(value = 1): GridTrack {
  return { sizing: 'FR', value }
}

function fixed(value: number): GridTrack {
  return { sizing: 'FIXED', value }
}

describe('Grid Layout', () => {
  describe('basic grid', () => {
    test('places children in 2x2 equal columns', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr(), fr()], [fr(), fr()])
      for (let i = 0; i < 4; i++) rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // Row 1: (0,0) and (200,0)
      expect(children[0].x).toBe(0)
      expect(children[0].y).toBe(0)
      expect(children[1].x).toBe(200)
      expect(children[1].y).toBe(0)
      // Row 2: (0,150) and (200,150)
      expect(children[2].x).toBe(0)
      expect(children[2].y).toBe(150)
      expect(children[3].x).toBe(200)
      expect(children[3].y).toBe(150)
    })

    test('fixed column widths', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fixed(100), fixed(300)], [fr()])
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[0].width).toBe(50)
      expect(children[1].x).toBe(100)
      expect(children[1].width).toBe(50)
    })

    test('mixed fr and fixed columns', () => {
      const graph = new SceneGraph()
      // 400px wide: 100px fixed + 300px remaining as 1fr
      const frame = gridFrame(graph, pageId(graph), [fixed(100), fr()], [fr()])
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(100)
    })

    test('unequal fr columns', () => {
      const graph = new SceneGraph()
      // 1fr + 2fr = 3fr total → 133.33px + 266.67px
      const frame = gridFrame(
        graph, pageId(graph),
        [fr(1), fr(2)],
        [fr()],
        { width: 300, height: 100 },
      )
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBeCloseTo(100, 0)
    })
  })

  describe('gaps', () => {
    test('column gap', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(
        graph, pageId(graph),
        [fr(), fr()],
        [fr()],
        { gridColumnGap: 20 },
      )
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // (400 - 20) / 2 = 190 per column
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(210)
    })

    test('row gap', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(
        graph, pageId(graph),
        [fr()],
        [fr(), fr()],
        { gridRowGap: 20, height: 200 },
      )
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].y).toBe(0)
      // (200 - 20) / 2 = 90 per row
      expect(children[1].y).toBe(110)
    })

    test('both column and row gaps', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(
        graph, pageId(graph),
        [fr(), fr()],
        [fr(), fr()],
        { gridColumnGap: 10, gridRowGap: 10, width: 210, height: 210 },
      )
      for (let i = 0; i < 4; i++) rect(graph, frame.id, 30, 30)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      // (210 - 10) / 2 = 100 per col, (210 - 10) / 2 = 100 per row
      expect(children[0].x).toBe(0)
      expect(children[0].y).toBe(0)
      expect(children[1].x).toBe(110)
      expect(children[1].y).toBe(0)
      expect(children[2].x).toBe(0)
      expect(children[2].y).toBe(110)
      expect(children[3].x).toBe(110)
      expect(children[3].y).toBe(110)
    })
  })

  describe('padding', () => {
    test('padding offsets grid content', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(
        graph, pageId(graph),
        [fr()],
        [fr()],
        { paddingTop: 10, paddingLeft: 20, paddingRight: 30, paddingBottom: 40 },
      )
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.x).toBe(20)
      expect(child.y).toBe(10)
    })
  })

  describe('explicit placement', () => {
    test('gridPosition places child at specific cell', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr(), fr(), fr()], [fr(), fr()])
      // Place in column 2, row 1 (0-indexed internally, but yoga uses 1-indexed)
      rect(graph, frame.id, 50, 50, {
        gridPosition: { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
      })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      // Column 2 starts at 400/3 ≈ 133px
      expect(child.x).toBeCloseTo(133, 0)
      expect(child.y).toBe(0)
    })

    test('column span stretches across multiple columns', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(
        graph, pageId(graph),
        [fr(), fr(), fr()],
        [fr()],
        { width: 300, height: 100 },
      )
      rect(graph, frame.id, 50, 50, {
        gridPosition: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
      })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.x).toBe(0)
      // Child keeps its own 50px width since it's not set to fill
      expect(child.width).toBe(50)
    })

    test('row span stretches across multiple rows', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(
        graph, pageId(graph),
        [fr()],
        [fr(), fr(), fr()],
        { width: 100, height: 300 },
      )
      rect(graph, frame.id, 50, 50, {
        gridPosition: { column: 1, row: 1, columnSpan: 1, rowSpan: 2 },
      })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.y).toBe(0)
      expect(child.height).toBe(50)
    })
  })

  describe('absolute children', () => {
    test('absolute children are skipped in grid layout', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr(), fr()], [fr()])
      rect(graph, frame.id, 50, 50)
      rect(graph, frame.id, 50, 50, { layoutPositioning: 'ABSOLUTE', x: 300, y: 200 })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].x).toBe(0)
      expect(children[1].x).toBe(300)
      expect(children[1].y).toBe(200)
      expect(children[2].x).toBe(200)
    })
  })

  describe('hidden children', () => {
    test('hidden children preserve size in grid', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr(), fr()], [fr()])
      rect(graph, frame.id, 50, 50, { visible: false })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(50)
      expect(children[0].height).toBe(50)
    })
  })

  describe('flex-to-grid switch', () => {
    test('HUG frame expands to fit children in grid', () => {
      const graph = new SceneGraph()
      const page = pageId(graph)

      const frame = autoFrame(graph, page, {
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        width: 100,
        height: 100,
      })
      rect(graph, frame.id, 80, 80)
      rect(graph, frame.id, 80, 80)
      rect(graph, frame.id, 80, 80)
      rect(graph, frame.id, 80, 80)

      computeLayout(graph, frame.id)
      const hugNode = graph.getNode(frame.id)!
      expect(hugNode.width).toBe(80)
      expect(hugNode.height).toBe(320)

      const children = graph.getChildren(frame.id)
      const cols = Math.max(2, Math.ceil(Math.sqrt(children.length)))
      const rows = Math.max(1, Math.ceil(children.length / cols))
      const maxChildW = Math.max(...children.map((c) => c.width))
      const maxChildH = Math.max(...children.map((c) => c.height))

      graph.updateNode(frame.id, {
        layoutMode: 'GRID',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        width: maxChildW * cols,
        height: maxChildH * rows,
        gridTemplateColumns: Array.from({ length: cols }, () => ({ sizing: 'FR' as const, value: 1 })),
        gridTemplateRows: Array.from({ length: rows }, () => ({ sizing: 'FR' as const, value: 1 })),
        gridColumnGap: 0,
        gridRowGap: 0,
      })

      computeLayout(graph, frame.id)

      const gridNode = graph.getNode(frame.id)!
      expect(gridNode.width).toBe(160)
      expect(gridNode.height).toBe(160)

      const gridChildren = graph.getChildren(frame.id)
      expect(gridChildren[0].x).toBe(0)
      expect(gridChildren[0].y).toBe(0)
      expect(gridChildren[1].x).toBe(80)
      expect(gridChildren[1].y).toBe(0)
      expect(gridChildren[2].x).toBe(0)
      expect(gridChildren[2].y).toBe(80)
      expect(gridChildren[3].x).toBe(80)
      expect(gridChildren[3].y).toBe(80)
    })
  })

  describe('computeAllLayouts with grid', () => {
    test('grid frames are computed in bottom-up pass', () => {
      const graph = new SceneGraph()
      const page = pageId(graph)
      const outer = autoFrame(graph, page, {
        layoutMode: 'VERTICAL',
        width: 400,
        height: 600,
        itemSpacing: 10,
      })
      const inner = gridFrame(graph, outer.id, [fr(), fr()], [fr()], {
        width: 380,
        height: 100,
      })
      rect(graph, inner.id, 50, 50)
      rect(graph, inner.id, 50, 50)
      rect(graph, outer.id, 100, 50)

      computeAllLayouts(graph)

      const innerChildren = graph.getChildren(inner.id)
      expect(innerChildren[0].x).toBe(0)
      expect(innerChildren[1].x).toBe(190)

      const outerChildren = graph.getChildren(outer.id)
      expect(outerChildren[0].y).toBe(0)
      expect(outerChildren[1].y).toBe(110)
    })
  })

  describe('grid stretch sizing', () => {
    test('STRETCH child fills grid cell', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr(), fr()], [fr()], {
        width: 300,
        height: 100,
      })
      rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'STRETCH' as const })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(150)
      expect(children[0].height).toBe(100)
    })

    test('layoutGrow child fills grid cell', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr(), fr()], [fr()], {
        width: 400,
        height: 200,
      })
      rect(graph, frame.id, 50, 50, { layoutGrow: 1 })
      rect(graph, frame.id, 50, 50)

      computeLayout(graph, frame.id)

      const children = graph.getChildren(frame.id)
      expect(children[0].width).toBe(200)
      expect(children[0].height).toBe(200)
    })
  })

  describe('layoutSizingVertical with cross-axis children', () => {
    test('HORIZONTAL children in VERTICAL parent respect FIXED height after layout', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)

      const root = api.createFrame()
      root.layoutMode = 'VERTICAL'
      root.resize(375, 812)
      api.currentPage.appendChild(root)

      const statusBar = api.createFrame()
      statusBar.layoutMode = 'HORIZONTAL'
      root.appendChild(statusBar)
      statusBar.layoutSizingHorizontal = 'FILL'
      statusBar.layoutSizingVertical = 'FIXED'
      statusBar.resize(375, 44)

      const toolbar = api.createFrame()
      toolbar.layoutMode = 'HORIZONTAL'
      root.appendChild(toolbar)
      toolbar.layoutSizingHorizontal = 'FILL'
      toolbar.layoutSizingVertical = 'FIXED'
      toolbar.resize(375, 52)

      const canvas = api.createFrame()
      root.appendChild(canvas)
      canvas.layoutSizingHorizontal = 'FILL'
      canvas.layoutSizingVertical = 'FILL'

      const panel = api.createFrame()
      panel.layoutMode = 'VERTICAL'
      root.appendChild(panel)
      panel.layoutSizingHorizontal = 'FILL'
      panel.layoutSizingVertical = 'FIXED'
      panel.resize(375, 220)

      computeAllLayouts(graph)

      const sb = graph.getNode(statusBar.id)!
      const tb = graph.getNode(toolbar.id)!
      const cv = graph.getNode(canvas.id)!
      const pn = graph.getNode(panel.id)!

      expect(sb.height).toBe(44)
      expect(tb.height).toBe(52)
      expect(pn.height).toBe(220)
      expect(cv.height).toBe(812 - 44 - 52 - 220)
    })
  })
})
