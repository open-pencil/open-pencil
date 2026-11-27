import { afterEach, describe, expect, test } from 'bun:test'

import {
  defaultSlideTransition,
  slideBuild,
  slideRows,
  slideSettings
} from '@open-pencil/scene-graph/slides'
import { expectDefined } from '@open-pencil/test-support/assert'

import { createEditor } from '#core/editor'
import { createDocumentGraph } from '#core/editor/document-settings'

type Editor = ReturnType<typeof createEditor>
const opened: Editor[] = []
afterEach(() => {
  for (const editor of opened.splice(0)) editor.dispose()
})

/** A deck of two slides, the first holding a title, a box, and a circle. */
function setup() {
  const editor = createEditor()
  opened.push(editor)
  editor.replaceGraph(createDocumentGraph('slides', 'light'))
  const [first] = slideRows(editor.graph, editor.state.currentPageId).flat()
  const second = expectDefined(editor.addSlide(first.id))
  const layer = (name: string) => editor.graph.createNode('RECTANGLE', first.id, { name }).id
  return {
    editor,
    first: first.id,
    second,
    title: layer('Title'),
    box: layer('Box'),
    dot: layer('Dot')
  }
}

const order = (editor: Editor, slideId: string) =>
  slideBuild(editor.graph, slideId).flatMap((step) =>
    step.layers.map(({ id }) => editor.graph.getNode(id)?.name)
  )

describe('the Animate tab edits', () => {
  test('animations are added after the slide steps, as one undo step', () => {
    const { editor, first, title, box, dot } = setup()
    editor.addLayerAnimations([title])
    editor.addLayerAnimations([dot, box])
    expect(order(editor, first)).toEqual(['Title', 'Box', 'Dot'])
    editor.undo.undo()
    expect(order(editor, first)).toEqual(['Title'])
  })

  test('a step moves to another place, and the rest follow', () => {
    const { editor, first, title, box, dot } = setup()
    editor.addLayerAnimations([title, box, dot])
    editor.moveLayerAnimation(dot, 0)
    expect(order(editor, first)).toEqual(['Dot', 'Title', 'Box'])
    editor.undo.undo()
    expect(order(editor, first)).toEqual(['Title', 'Box', 'Dot'])
  })

  test('changing and removing an animation are undone exactly', () => {
    const { editor, first, title } = setup()
    editor.addLayerAnimations([title])
    editor.setLayerAnimations([title], (current) => ({ ...current, style: 'FADE' }))
    expect(editor.graph.getNode(title)?.animation?.style).toBe('FADE')
    editor.removeLayerAnimations([title])
    expect(order(editor, first)).toEqual([])
    editor.undo.undo()
    editor.undo.undo()
    expect(editor.graph.getNode(title)?.animation?.style).toBe('SLIDE_FROM_LEFT')
  })

  test('a transition is set on several slides at once, each keeping the rest of its own', () => {
    const { editor, first, second } = setup()
    editor.setSlideTransition([first], { ...defaultSlideTransition(), duration: 2 })
    editor.setSlideTransition([first, second], (current) => ({
      ...current,
      style: 'PUSH_FROM_RIGHT'
    }))
    const transition = (id: string) =>
      slideSettings(expectDefined(editor.graph.getNode(id)))?.transition
    expect(transition(first)).toMatchObject({ style: 'PUSH_FROM_RIGHT', duration: 2 })
    expect(transition(second)).toMatchObject({ style: 'PUSH_FROM_RIGHT', duration: 0.3 })
    editor.setSlideTransition([first], null)
    expect(transition(first)).toBeNull()
  })

  test('a layer inside an instance animates as its instance, as in Figma', () => {
    const { editor, first } = setup()
    const card = editor.graph.createNode('COMPONENT', first, { name: 'Card' })
    editor.graph.createNode('ELLIPSE', card.id, { name: 'Dot' })
    const instance = expectDefined(editor.graph.createInstance(card.id, first))
    const [inner] = editor.graph.getChildren(instance.id)
    editor.addLayerAnimations([inner.id])
    expect(editor.graph.getNode(instance.id)?.animation).not.toBeNull()
    expect(editor.graph.getNode(inner.id)?.animation).toBeNull()
  })
})
