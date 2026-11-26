import { describe, expect, test } from 'bun:test'

import {
  createSlide,
  createSlideRow,
  slideGrid,
  slideDropAt,
  slideRows,
  slideSettings
} from '@open-pencil/scene-graph/slides'
import { expectDefined } from '@open-pencil/test-support/assert'

import { canvasRootId, createEditor } from '#core/editor'
import { createDocumentGraph } from '#core/editor/document-settings'

/** A deck of three slides in two sections: A and B, then C. */
function setup() {
  const editor = createEditor()
  editor.replaceGraph(createDocumentGraph('slides', 'light'))
  const a = expectDefined(slides(editor)[0]?.[0])
  const b = expectDefined(editor.addSlide(a))
  const c = expectDefined(editor.addSlide(b))
  editor.moveSlides([c], { type: 'section', before: null })
  return { editor, a, b, c }
}

type Editor = ReturnType<typeof createEditor>

function slides(editor: Editor): string[][] {
  return slideRows(editor.graph, editor.state.currentPageId).map((row) => row.map(({ id }) => id))
}

function names(editor: Editor): string[] {
  return slides(editor)
    .flat()
    .map((id) => expectDefined(editor.graph.getNode(id)).name)
}

const selected = (editor: Editor) => [...editor.state.selectedIds]

describe('slides', () => {
  test('a new slide follows the selected one at its size, selected and numbered', () => {
    const { editor, a, b, c } = setup()
    editor.graph.updateNode(a, { width: 1440 })
    editor.select([a])
    const added = expectDefined(editor.addSlide())
    expect(slides(editor)).toEqual([[a, added, b], [c]])
    expect(editor.graph.getNode(added)).toMatchObject({ width: 1440, height: 1080 })
    expect(names(editor)).toEqual(['1', '2', '3', '4'])
    expect(selected(editor)).toEqual([added])
    editor.undo.undo()
    expect(slides(editor)).toEqual([[a, b], [c]])
    expect(selected(editor)).toEqual([a])
    editor.undo.redo()
    expect(slides(editor)).toEqual([[a, added, b], [c]])
  })

  test('deleting selects the next slide, else the one before, and drops an empty section', () => {
    const { editor, a, b, c } = setup()
    editor.select([a])
    editor.deleteSelected()
    expect(slides(editor)).toEqual([[b], [c]])
    expect(selected(editor)).toEqual([b])
    editor.deleteSlides([c])
    expect(slides(editor)).toEqual([[b]])
    expect(selected(editor)).toEqual([b])
    editor.undo.undo()
    editor.undo.undo()
    expect(slides(editor)).toEqual([[a, b], [c]])
    expect(names(editor)).toEqual(['1', '2', '3'])
  })

  test('an undone delete brings back the slide with its layers', () => {
    const { editor, a } = setup()
    const layer = editor.graph.createNode('RECTANGLE', a, { name: 'Box' })
    editor.deleteSlides([a])
    expect(editor.graph.getNode(layer.id)).toBeUndefined()
    editor.undo.undo()
    expect(editor.graph.getNode(layer.id)).toMatchObject({ name: 'Box', parentId: a })
  })

  test('deleting every slide leaves a deck that takes a new one', () => {
    const { editor, a, b, c } = setup()
    editor.deleteSlides([a, b, c])
    expect(slides(editor)).toEqual([])
    const added = expectDefined(editor.addSlide())
    expect(slides(editor)).toEqual([[added]])
    editor.undo.undo()
    editor.undo.undo()
    expect(slides(editor)).toEqual([[a, b], [c]])
  })

  test('copies follow the last of the copied slides', () => {
    const { editor, a, b, c } = setup()
    editor.select([b, a])
    editor.duplicateSelected()
    const [first, second] = slides(editor)
    expect(first.slice(0, 2)).toEqual([a, b])
    expect(first).toHaveLength(4)
    expect(second).toEqual([c])
    expect(selected(editor)).toEqual(first.slice(2))
  })

  test('slides move beside another, whichever way and wherever they were', () => {
    const { editor, a, b, c } = setup()
    editor.moveSlides([a], { type: 'beside', slideId: b, side: 'after' })
    expect(slides(editor)).toEqual([[b, a], [c]])
    editor.moveSlides([a, b], { type: 'beside', slideId: c, side: 'before' })
    expect(slides(editor)).toEqual([[b, a, c]])
    editor.moveSlides([a, c], { type: 'beside', slideId: a, side: 'before' })
    expect(slides(editor)).toEqual([[b, a, c]])
    editor.moveSlides([c], { type: 'section', before: expectDefined(rowOf(editor, b)) })
    expect(slides(editor)).toEqual([[c], [b, a]])
    editor.moveSlides([c, b], { type: 'beside', slideId: b, side: 'after' })
    expect(slides(editor)).toEqual([[c], [b, a]])
    for (let step = 0; step < 3; step++) editor.undo.undo()
    expect(slides(editor)).toEqual([[a, b], [c]])
  })

  test('undo and redo keep a slide added meanwhile by someone else', () => {
    const { editor, a, b, c } = setup()
    editor.deleteSlides([a])
    const theirs = createSlide(editor.graph, expectDefined(rowOf(editor, c) ?? undefined)).id
    const alone = createSlide(
      editor.graph,
      createSlideRow(
        editor.graph,
        expectDefined(slideGrid(editor.graph, editor.state.currentPageId)).id
      ).id
    ).id
    editor.undo.undo()
    expect(slides(editor)).toEqual([[a, b], [c, theirs], [alone]])
    editor.undo.redo()
    expect(slides(editor)).toEqual([[b], [c, theirs], [alone]])
  })

  test('a skipped slide has no number', () => {
    const { editor, b } = setup()
    editor.setSlidesSkipped([b], true)
    expect(names(editor)).toEqual(['1', '-', '2'])
    expect(slideSettings(expectDefined(editor.graph.getNode(b)))?.skipped).toBe(true)
    editor.undo.undo()
    expect(names(editor)).toEqual(['1', '2', '3'])
  })

  test('the stage follows adding, deleting, and the neighbouring slide', () => {
    const { editor, a, b, c } = setup()
    editor.focusSlide(a)
    editor.select([a])
    const added = editor.addSlide()
    expect(editor.state.focusedSlideId).toBe(added)
    editor.undo.undo()
    expect(editor.state.focusedSlideId).toBe(a)
    editor.focusAdjacentSlide(-1)
    expect(editor.state.focusedSlideId).toBe(a)
    editor.focusAdjacentSlide(1)
    expect(editor.state.focusedSlideId).toBe(b)
    editor.deleteSlides([b])
    expect(editor.state.focusedSlideId).toBe(c)
  })
})

function rowOf(editor: Editor, id: string): string | null | undefined {
  return editor.graph.getNode(id)?.parentId
}

test('arrow keys leave slides where the deck lays them out', () => {
  const { editor, a, b, c } = setup()
  editor.select([a])
  editor.nudgeSelected(1, 0)
  expect(slides(editor)).toEqual([[a, b], [c]])
})

test('clicks and new layers on the stage belong to the slide it shows', () => {
  const { editor, a } = setup()
  editor.focusSlide(null)
  expect(canvasRootId(editor.graph, editor.state)).toBe(editor.state.currentPageId)
  editor.focusSlide(a)
  expect(canvasRootId(editor.graph, editor.state)).toBe(a)
})

test('a deck opens on its first slide, and a design on the whole page', () => {
  const editor = createEditor()
  editor.replaceGraph(createDocumentGraph('slides', 'light'))
  expect(editor.state.focusedSlideId).toBe(expectDefined(slides(editor)[0]?.[0]))
  editor.replaceGraph(createDocumentGraph('design', 'light'))
  expect(editor.state.focusedSlideId).toBeNull()
  const opened = createEditor({ graph: createDocumentGraph('slides', 'light') })
  expect(names(opened)).toEqual(['1'])
  expect(opened.state.focusedSlideId).toBe(expectDefined(slides(opened)[0]?.[0]))
})

test('a drop on the grid lands beside the nearest slide, or between sections as a new one', () => {
  const { editor, a, b, c } = setup()
  const page = editor.state.currentPageId
  const box = (id: string) => {
    const node = expectDefined(editor.graph.getNode(id))
    return { ...editor.graph.getAbsolutePosition(id), width: node.width, height: node.height }
  }
  const at = (x: number, y: number) => slideDropAt(editor.graph, page, { x, y })?.placement
  const slideB = box(b)
  const middle = slideB.y + slideB.height / 2
  expect(at(slideB.x + 10, middle)).toEqual({ type: 'beside', slideId: b, side: 'before' })
  expect(at(slideB.x + slideB.width + 50, middle)).toEqual({
    type: 'beside',
    slideId: b,
    side: 'after'
  })
  const first = expectDefined(editor.graph.getNode(a)).parentId
  const second = expectDefined(editor.graph.getNode(c)).parentId
  const slideC = box(c)
  expect(at(slideC.x, slideB.y + slideB.height + 10)).toEqual({ type: 'section', before: second })
  expect(at(slideC.x, slideC.y + slideC.height + 10)).toEqual({ type: 'section', before: null })
  expect(at(slideC.x, box(a).y - 10)).toEqual({ type: 'section', before: first })
})

test('notes change as one undo step, and the same text adds none', () => {
  const { editor, a } = setup()
  const notes = () => slideSettings(expectDefined(editor.graph.getNode(a)))?.notes
  editor.setSlideNotes(a, 'Open with the numbers\nThen the plan')
  editor.setSlideNotes(a, 'Open with the numbers\nThen the plan')
  expect(notes()).toBe('Open with the numbers\nThen the plan')
  editor.undo.undo()
  expect(notes()).toBe('')
  editor.undo.redo()
  expect(notes()).toBe('Open with the numbers\nThen the plan')
})
