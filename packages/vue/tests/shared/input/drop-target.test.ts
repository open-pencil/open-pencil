import { afterEach, expect, test } from 'bun:test'

import { createDocumentGraph, createEditor, type Editor } from '@open-pencil/core'

import { findEnclosingDrawParent } from '#vue/shared/input/drop-target'

let editor: Editor

afterEach(() => editor.dispose())

test('a stroke on the slide on the stage stays on it, even past its edge', () => {
  editor = createEditor({ graph: createDocumentGraph('slides', 'light') })
  const slide = editor.state.focusedSlideId
  if (!slide) throw new Error('A new deck opens on its first slide')
  // A second slide lays the deck out, so its row spans the gap beside the first.
  editor.addSlide(slide)
  editor.focusSlide(slide)
  const origin = editor.graph.getAbsolutePosition(slide)
  // From inside the slide out into the gap beside it, which its row and the grid still cover.
  const points = [
    { x: origin.x + 100, y: origin.y + 100 },
    { x: origin.x + 2000, y: origin.y + 100 }
  ]
  expect(findEnclosingDrawParent(points, 'VECTOR', editor)).toBe(slide)
})
