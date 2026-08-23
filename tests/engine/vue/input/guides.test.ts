import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { createGuideInput, selectedTopLevelGuideFrameId } from '#vue/canvas/guides/input'
import type { DragState } from '#vue/shared/input/types'

function setup() {
  const editor = createEditor()
  Object.assign(editor.state, { showRulers: true })
  let drag: DragState | null = null
  const input = createGuideInput({
    canvasRef: ref({ clientWidth: 500, clientHeight: 500 } as HTMLCanvasElement),
    editor,
    canvasToLocal: (cx, cy, scopeId) => {
      const owner = editor.graph.getNode(scopeId)
      return { lx: cx - (owner?.x ?? 0), ly: cy - (owner?.y ?? 0) }
    },
    setDrag: (next) => {
      drag = next
    },
    setCursor: () => undefined
  })
  return { editor, input, getDrag: () => drag }
}

describe('guide canvas input', () => {
  test('does not create a guide from a ruler click without movement', () => {
    const { editor, input, getDrag } = setup()
    expect(input.tryStartFromRuler(100, 5, 100, 5)).toBe(true)
    const drag = getDrag()
    expect(drag?.type).toBe('guide')
    if (drag?.type === 'guide') input.finish(drag)
    expect(editor.graph.getNode(editor.state.currentPageId)?.guides).toEqual([])
  })

  test('publishes live preview after the drag threshold and commits on release', () => {
    const { editor, input, getDrag } = setup()
    input.tryStartFromRuler(100, 5, 100, 5)
    const drag = getDrag()
    if (drag?.type !== 'guide') throw new Error('Expected guide drag')

    input.handleMove(drag, 100, 40, 100, 40)
    expect(editor.state.guides.preview).toMatchObject({ axis: 'y', position: 40 })
    expect(editor.graph.getNode(editor.state.currentPageId)?.guides).toEqual([])

    input.finish(drag)
    expect(editor.graph.getNode(editor.state.currentPageId)?.guides[0]).toMatchObject({
      axis: 'y',
      position: 40
    })
  })

  test('Option-drag duplicates an existing guide and preserves the source', () => {
    const { editor, input, getDrag } = setup()
    const pageId = editor.state.currentPageId
    const sourceId = editor.addGuide(pageId, 'x', 40)
    editor.undo.clear()

    expect(input.tryStartExisting(40, 100, true)).toBe(true)
    const drag = getDrag()
    if (drag?.type !== 'guide') throw new Error('Expected guide drag')
    input.handleMove(drag, 80, 100, 80, 100)
    expect(editor.state.guides.preview?.source).toBeUndefined()
    input.finish(drag)

    const guides = editor.graph.getNode(pageId)?.guides ?? []
    expect(guides).toHaveLength(2)
    expect(guides).toContainEqual({ id: sourceId, axis: 'x', position: 40 })
    expect(guides.some((guide) => guide.id !== sourceId && guide.position === 80)).toBe(true)
  })

  test('discarding an Option-drag on the ruler preserves the source guide', () => {
    const { editor, input, getDrag } = setup()
    const pageId = editor.state.currentPageId
    const sourceId = editor.addGuide(pageId, 'x', 40)
    input.tryStartExisting(40, 100, true)
    const drag = getDrag()
    if (drag?.type !== 'guide') throw new Error('Expected guide drag')
    input.handleMove(drag, 5, 100, 5, 100)
    input.finish(drag)
    expect(editor.graph.getNode(pageId)?.guides).toEqual([
      { id: sourceId, axis: 'x', position: 40 }
    ])
  })

  test('keeps a selected top-level frame as owner over nested frame content', () => {
    const { editor, input, getDrag } = setup()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 300,
      height: 200
    })
    const nested = editor.graph.createNode('FRAME', frame.id, {
      x: 40,
      y: 30,
      width: 100,
      height: 80
    })
    editor.graph.hitTestDeep = () => nested
    editor.select([frame.id])
    input.tryStartFromRuler(100, 5, 100, 5)
    const drag = getDrag()
    if (drag?.type !== 'guide') throw new Error('Expected guide drag')
    const selectedFrameId = selectedTopLevelGuideFrameId(editor)
    expect(selectedFrameId).toBe(frame.id)

    input.handleMove(drag, 200, 200, 200, 200, {
      frameId: selectedFrameId ?? '',
      deep: false
    })
    expect(drag.ownerId).toBe(frame.id)
    expect(drag.position).toBe(100)
    expect(editor.state.guides.preview?.ownerId).toBe(frame.id)
    input.finish(drag)
    expect(editor.graph.getNode(frame.id)?.guides).toHaveLength(1)
    expect(editor.graph.getNode(nested.id)?.guides).toEqual([])
  })

  test('ruler hover takes precedence over an intersecting existing guide', () => {
    const { editor, input } = setup()
    editor.addGuide(editor.state.currentPageId, 'x', 100)
    expect(input.updateHover(100, 5)).toBe('ns-resize')
    expect(editor.state.guides.hovered).toBeNull()
  })
})
