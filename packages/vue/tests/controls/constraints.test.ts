import { describe, expect, test } from 'bun:test'

import { defineComponent, h } from 'vue'

import { createEditor, type Editor } from '@open-pencil/core'
import type { ConstraintType } from '@open-pencil/scene-graph'
import {
  collectResizeDescendants,
  constrainedChildRect,
  type ResizeSnapshot
} from '@open-pencil/scene-graph/resize'
import { firstPageId, makeSceneGraph } from '@open-pencil/test-support/scene'
import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'
import {
  constraintPins,
  toggleConstraintPin,
  useConstraints
} from '@open-pencil/vue/controls/constraints'

import { provideEditor } from '#vue/editor/context'

import { MIXED } from '#vue/controls/node-props/use'
import { applyResize } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'
function original(node: {
  type: ResizeSnapshot['type']
  x: number
  y: number
  width: number
  height: number
  vectorNetwork: ResizeSnapshot['vectorNetwork']
}): ResizeSnapshot {
  return {
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    flipX: false,
    flipY: false,
    vectorNetwork: node.vectorNetwork,
    fillGeometry: [],
    strokeGeometry: [],
    derivedTextGlyphs: null,
    strokes: [],
    textPathData: null,
    textPathBox: null
  }
}

describe('constraint control model', () => {
  test('maps edge pins and additive pin toggles', () => {
    expect(constraintPins('STRETCH')).toMatchObject({ leading: true, trailing: true })
    expect(toggleConstraintPin('MAX', 'leading', false)).toBe('MIN')
    expect(toggleConstraintPin('MAX', 'leading', true)).toBe('STRETCH')
    expect(toggleConstraintPin('STRETCH', 'leading', true)).toBe('MAX')
    expect(toggleConstraintPin('MIN', 'leading', true)).toBe('CENTER')
  })
})

describe('constraint resize geometry', () => {
  const child: ResizeSnapshot = {
    type: 'RECTANGLE',
    x: 20,
    y: 30,
    width: 40,
    height: 20,
    flipX: false,
    flipY: false,
    vectorNetwork: null,
    fillGeometry: [],
    strokeGeometry: [],
    derivedTextGlyphs: null,
    strokes: [],
    textPathData: null,
    textPathBox: null
  }
  const expectedX: Record<ConstraintType, [number, number]> = {
    MIN: [20, 40],
    CENTER: [70, 40],
    MAX: [120, 40],
    STRETCH: [20, 140],
    SCALE: [40, 80]
  }

  for (const constraint of Object.keys(expectedX) as ConstraintType[]) {
    test(`applies ${constraint} on one axis`, () => {
      const rect = constrainedChildRect(
        child,
        { width: 100, height: 100 },
        { width: 200, height: 100 },
        constraint,
        'MIN'
      )
      expect([rect.x, rect.width]).toEqual(expectedX[constraint])
      expect([rect.y, rect.height]).toEqual([30, 20])
    })
  }

  test('recurses through constrained nested frames during resize preview', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const root = graph.createNode('FRAME', pageId, { width: 100, height: 100 })
    const nested = graph.createNode('FRAME', root.id, {
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      horizontalConstraint: 'STRETCH'
    })
    const grandchild = graph.createNode('RECTANGLE', nested.id, {
      x: 30,
      y: 10,
      width: 10,
      height: 10,
      horizontalConstraint: 'MAX'
    })
    const editor = createEditor({ graph })
    const drag: DragResize = {
      type: 'resize',
      handle: 'se',
      startX: 100,
      startY: 100,
      origRect: { x: root.x, y: root.y, width: root.width, height: root.height },
      nodeId: root.id,
      origVectorNetwork: null,
      origFillGeometry: [],
      origStrokeGeometry: [],
      origDerivedTextGlyphs: null,
      origStrokes: [],
      origTextPathData: null,
      origTextPathBox: null,
      lockedAspectRatio: null,
      origChildren: new Map([
        [nested.id, original(nested)],
        [grandchild.id, original(grandchild)]
      ])
    }

    applyResize(drag, 200, 100, false, editor)

    expect(graph.getNode(nested.id)).toMatchObject({ x: 10, width: 150 })
    expect(graph.getNode(grandchild.id)).toMatchObject({ x: 130, width: 10 })
  })

  test('repositions constrained descendants after an in-flow child grows in resize preview', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const root = graph.createNode('FRAME', pageId, {
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const nested = graph.createNode('FRAME', root.id, {
      width: 100,
      height: 100,
      layoutGrow: 1
    })
    const grandchild = graph.createNode('RECTANGLE', nested.id, {
      x: 80,
      y: 0,
      width: 10,
      height: 10,
      horizontalConstraint: 'MAX'
    })
    const editor = createEditor({ graph })
    const drag: DragResize = {
      type: 'resize',
      handle: 'e',
      startX: 100,
      startY: 50,
      origRect: { x: root.x, y: root.y, width: root.width, height: root.height },
      nodeId: root.id,
      origVectorNetwork: null,
      origFillGeometry: [],
      origStrokeGeometry: [],
      origDerivedTextGlyphs: null,
      origStrokes: [],
      origTextPathData: null,
      origTextPathBox: null,
      lockedAspectRatio: null,
      origChildren: collectResizeDescendants(graph, root.id)
    }

    applyResize(drag, 200, 50, false, editor)

    expect(graph.getNode(nested.id)?.width).toBe(200)
    expect(graph.getNode(grandchild.id)?.x).toBe(180)
  })
})

/** The constraints control as the Design panel mounts it, for the editor's selection. */
function mountConstraints(editor: Editor) {
  let control: ReturnType<typeof useConstraints> | undefined
  const Control = defineComponent({
    setup() {
      control = useConstraints()
      return () => h('div')
    }
  })
  const app = createTestRenderer().createApp(
    defineComponent({
      setup() {
        provideEditor(editor)
        return () => h(Control)
      }
    })
  )
  app.mount(hostNode())
  if (!control) throw new Error('Expected the constraints control')
  return { control, unmount: () => app.unmount() }
}

// Figma (desktop, 2026-11-08): a group owns no constraints; the panel shows its layers', Mixed
// where they differ, and a choice sets every layer in it, through nested groups.
describe("a group's constraints in the panel", () => {
  test('are its layers\', and setting one sets them all in one step', () => {
    const editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId)
    const group = editor.graph.createNode('GROUP', frame.id)
    const a = editor.graph.createNode('RECTANGLE', group.id, { horizontalConstraint: 'MAX' })
    const inner = editor.graph.createNode('GROUP', group.id)
    const b = editor.graph.createNode('RECTANGLE', inner.id)
    editor.select([group.id])
    const { control, unmount } = mountConstraints(editor)
    try {
      expect(control.active.value).toBe(true)
      expect(control.horizontal.value).toBe(MIXED)
      expect(control.vertical.value).toBe('MIN')

      control.setAxis('horizontal', 'CENTER')
      const horizontal = () => [a, b].map((n) => editor.graph.getNode(n.id)?.horizontalConstraint)
      expect(horizontal()).toEqual(['CENTER', 'CENTER'])
      expect(control.horizontal.value).toBe('CENTER')
      editor.undo.undo()
      expect(horizontal()).toEqual(['MAX', 'MIN'])
    } finally {
      unmount()
    }
  })

  test('a layer in a group shows its own', () => {
    const editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId)
    const group = editor.graph.createNode('GROUP', frame.id)
    const a = editor.graph.createNode('RECTANGLE', group.id, { verticalConstraint: 'SCALE' })
    editor.select([a.id])
    const { control, unmount } = mountConstraints(editor)
    try {
      expect(control.active.value).toBe(true)
      expect(control.vertical.value).toBe('SCALE')
    } finally {
      unmount()
    }
  })
})
