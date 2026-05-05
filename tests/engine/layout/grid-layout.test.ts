import { describe, expect, test } from 'bun:test'

import { autoFrame, fixed, fr, gridFrame, pageId, rect } from '#tests/helpers/layout'

import { computeLayout, computeAllLayouts, FigmaAPI, SceneGraph } from '@open-pencil/core'

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
      const frame = gridFrame(graph, pageId(graph), [fr(1), fr(2)], [fr()], {
        width: 300,
        height: 100
      })
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
      const frame = gridFrame(graph, pageId(graph), [fr(), fr()], [fr()], { gridColumnGap: 20 })
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
      const frame = gridFrame(graph, pageId(graph), [fr()], [fr(), fr()], {
        gridRowGap: 20,
        height: 200
      })
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
      const frame = gridFrame(graph, pageId(graph), [fr(), fr()], [fr(), fr()], {
        gridColumnGap: 10,
        gridRowGap: 10,
        width: 210,
        height: 210
      })
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
      const frame = gridFrame(graph, pageId(graph), [fr()], [fr()], {
        paddingTop: 10,
        paddingLeft: 20,
        paddingRight: 30,
        paddingBottom: 40
      })
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
        gridPosition: { column: 2, row: 1, columnSpan: 1, rowSpan: 1 }
      })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      // Column 2 starts at 400/3 ≈ 133px
      expect(child.x).toBeCloseTo(133, 0)
      expect(child.y).toBe(0)
    })

    test('column span stretches across multiple columns', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr(), fr(), fr()], [fr()], {
        width: 300,
        height: 100
      })
      rect(graph, frame.id, 50, 50, {
        gridPosition: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 }
      })

      computeLayout(graph, frame.id)

      const child = graph.getChildren(frame.id)[0]
      expect(child.x).toBe(0)
      // Child keeps its own 50px width since it's not set to fill
      expect(child.width).toBe(50)
    })

    test('row span stretches across multiple rows', () => {
      const graph = new SceneGraph()
      const frame = gridFrame(graph, pageId(graph), [fr()], [fr(), fr(), fr()], {
        width: 100,
        height: 300
      })
      rect(graph, frame.id, 50, 50, {
        gridPosition: { column: 1, row: 1, columnSpan: 1, rowSpan: 2 }
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
        height: 100
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
        gridTemplateColumns: Array.from({ length: cols }, () => ({
          sizing: 'FR' as const,
          value: 1
        })),
        gridTemplateRows: Array.from({ length: rows }, () => ({ sizing: 'FR' as const, value: 1 })),
        gridColumnGap: 0,
        gridRowGap: 0
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
        itemSpacing: 10
      })
      const inner = gridFrame(graph, outer.id, [fr(), fr()], [fr()], {
        width: 380,
        height: 100
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
        height: 100
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
        height: 200
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
