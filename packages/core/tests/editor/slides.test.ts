import { afterEach, describe, expect, test } from 'bun:test'

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
import { resolvePasteTarget, sourcePasteTarget } from '#core/editor/clipboard/paste/target'
import { createDocumentGraph } from '#core/editor/document-settings'

const opened: Editor[] = []

afterEach(() => {
  for (const editor of opened.splice(0)) editor.dispose()
})

/** An editor this file disposes after each test. */
function open(...args: Parameters<typeof createEditor>): Editor {
  const editor = createEditor(...args)
  opened.push(editor)
  return editor
}

/** A deck of three slides in two sections: A and B, then C. */
function setup() {
  const editor = open()
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
  const before = editor.graph.getAbsolutePosition(a)
  editor.nudgeSelected(1, 0)
  expect(slides(editor)).toEqual([[a, b], [c]])
  expect(editor.graph.getAbsolutePosition(a)).toEqual(before)
})

test('undoing a move puts back only the slides it moved, keeping a collaborator’s reorder', () => {
  const { editor, a, b } = setup()
  const d = expectDefined(editor.addSlide(b))
  editor.moveSlides([a], { type: 'beside', slideId: b, side: 'after' })
  expect(slides(editor)[0]).toEqual([b, a, d])
  // A collaborator moves D to the front of the section meanwhile.
  editor.graph.insertChildAt(d, expectDefined(editor.graph.getNode(d)?.parentId), 0)
  editor.undo.undo()
  expect(slides(editor)[0]).toEqual([a, d, b])
  editor.undo.redo()
  expect(slides(editor)[0]).toEqual([d, b, a])
})

test('clicks and new layers on the stage belong to the slide it shows', () => {
  const { editor, a } = setup()
  editor.focusSlide(null)
  expect(canvasRootId(editor.graph, editor.state)).toBe(editor.state.currentPageId)
  editor.focusSlide(a)
  expect(canvasRootId(editor.graph, editor.state)).toBe(a)
})

test('a deck opens on its first slide, and a design on the whole page', () => {
  const editor = open()
  editor.replaceGraph(createDocumentGraph('slides', 'light'))
  expect(editor.state.focusedSlideId).toBe(expectDefined(slides(editor)[0]?.[0]))
  editor.replaceGraph(createDocumentGraph('design', 'light'))
  expect(editor.state.focusedSlideId).toBeNull()
  const fresh = open({ graph: createDocumentGraph('slides', 'light') })
  expect(names(fresh)).toEqual(['1'])
  expect(fresh.state.focusedSlideId).toBe(expectDefined(slides(fresh)[0]?.[0]))
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

describe('slide size', () => {
  function withBox(editor: Editor, slideId: string) {
    return editor.graph.createNode('RECTANGLE', slideId, {
      x: 910,
      y: 490,
      width: 100,
      height: 100,
      horizontalConstraint: 'CENTER',
      verticalConstraint: 'CENTER'
    }).id
  }
  const rect = (editor: Editor, id: string) => {
    const { x, y, width, height } = expectDefined(editor.graph.getNode(id))
    return { x, y, width, height }
  }

  test('keeping the content moves each layer by its constraints, as one undo step', () => {
    const { editor, a, b } = setup()
    const box = withBox(editor, a)
    editor.setSlideSize([a, b], { width: 1080, height: 1080 }, 'constraints')
    expect(rect(editor, a)).toMatchObject({ width: 1080, height: 1080 })
    expect(rect(editor, b)).toMatchObject({ width: 1080, height: 1080 })
    expect(rect(editor, box)).toEqual({ x: 490, y: 490, width: 100, height: 100 })
    editor.undo.undo()
    expect(rect(editor, a)).toMatchObject({ width: 1920, height: 1080 })
    expect(rect(editor, b)).toMatchObject({ width: 1920, height: 1080 })
    expect(rect(editor, box)).toEqual({ x: 910, y: 490, width: 100, height: 100 })
  })

  test('scaling the content fits it evenly and centres it', () => {
    const { editor, a } = setup()
    const box = withBox(editor, a)
    editor.setSlideSize([a], { width: 1440, height: 1080 }, 'scale')
    expect(rect(editor, box)).toEqual({ x: 682.5, y: 502.5, width: 75, height: 75 })
    editor.undo.undo()
    expect(rect(editor, a)).toMatchObject({ width: 1920, height: 1080 })
    expect(rect(editor, box)).toEqual({ x: 910, y: 490, width: 100, height: 100 })
    editor.undo.redo()
    expect(rect(editor, box)).toEqual({ x: 682.5, y: 502.5, width: 75, height: 75 })
  })

  test('the slide on the stage fills it again after a resize and its undo', () => {
    const { editor, a } = setup()
    editor.setViewportSize(1000, 800)
    editor.focusSlide(a)
    const fitted = editor.state.zoom
    editor.setSlideSize([a], { width: 1080, height: 1080 }, 'constraints')
    expect(editor.state.zoom).toBeGreaterThan(fitted)
    editor.undo.undo()
    expect(editor.state.zoom).toBeCloseTo(fitted)
  })
})

test('deleting the slide on the stage and undoing it comes back to Slide view', () => {
  const editor = open()
  editor.replaceGraph(createDocumentGraph('slides', 'light'))
  const only = expectDefined(editor.state.focusedSlideId)
  editor.deleteSlides([only])
  expect(editor.state.focusedSlideId).toBeNull()
  editor.undo.undo()
  expect(editor.state.focusedSlideId).toBe(only)
})

test('putting another slide on the stage drops the layers of the one before from the selection', () => {
  const { editor, a, b } = setup()
  const box = editor.graph.createNode('RECTANGLE', a, { width: 10, height: 10 }).id
  editor.focusSlide(a)
  editor.select([box, b])
  editor.focusSlide(b)
  expect(selected(editor)).toEqual([b])
})

test('a paste with nothing selected goes back to its frame only while that frame is on the stage', () => {
  const { editor, a, b } = setup()
  const frame = editor.graph.createNode('FRAME', a, { width: 200, height: 200 }).id
  editor.focusSlide(a)
  editor.select([])
  expect(sourcePasteTarget(editor, [frame])).toBe(frame)
  editor.focusSlide(b)
  expect(sourcePasteTarget(editor, [frame])).toBeNull()
})

test('undoing an edit made in Grid view comes back to Grid view', () => {
  const { editor, a } = setup()
  editor.focusSlide(null)
  editor.addSlide(a)
  editor.focusSlide(a)
  editor.undo.undo()
  expect(editor.state.focusedSlideId).toBeNull()
})

test('undoing a deck edit from another page renumbers the deck it changed', async () => {
  const { editor, a, b } = setup()
  editor.setSlidesSkipped([a], true)
  expect(names(editor)).toEqual(['-', '1', '2'])
  const deckPage = editor.state.currentPageId
  await editor.switchPage(editor.graph.addPage('Notes').id)
  editor.undo.undo()
  await editor.switchPage(deckPage)
  expect(names(editor)).toEqual(['1', '2', '3'])
  expect(slideSettings(expectDefined(editor.graph.getNode(a)))?.skipped).toBe(false)
  expect(editor.graph.getNode(b)?.name).toBe('2')
})

test('a paste with a slide selected off the stage goes onto the slide on the stage', () => {
  const { editor, a, b } = setup()
  editor.focusSlide(a)
  editor.select([b])
  expect(resolvePasteTarget(editor)).toBe(a)
})

test('undoing a Slide view edit from another page leaves the page shown as it is', async () => {
  const { editor, a } = setup()
  editor.focusSlide(a)
  const added = expectDefined(editor.addSlide(a))
  const deckPage = editor.state.currentPageId
  const other = editor.graph.addPage('Notes').id
  await editor.switchPage(other)
  editor.undo.undo()
  expect(editor.graph.getNode(added)).toBeUndefined()
  expect(editor.state.currentPageId).toBe(other)
  expect(canvasRootId(editor.graph, editor.state)).toBe(other)
  expect(selected(editor)).toEqual([])
  await editor.switchPage(deckPage)
})
