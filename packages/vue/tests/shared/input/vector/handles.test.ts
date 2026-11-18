import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { shownHandles } from '@open-pencil/core/vector'

import { hitTestEditHandle } from '#vue/shared/input/vector'

let editor: Editor

afterEach(() => editor.dispose())

const zero = { x: 0, y: 0 }

/**
 * A path (0,0) → (100,0) → (100,100) whose middle point has both handles ending at (60,40), in
 * edit mode with that point selected, so both show, the second segment's drawn on top.
 */
function setup() {
  editor = createEditor()
  const path = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
    width: 100,
    height: 100,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: zero, tangentEnd: { x: -40, y: 40 } },
        { start: 1, end: 2, tangentStart: { x: -40, y: 40 }, tangentEnd: zero }
      ],
      regions: []
    }
  })
  editor.enterNodeEditMode(path.id)
  editor.nodeEditSelectVertex(1, false)
}

test('lists the handles that show in the order the canvas draws them', () => {
  setup()
  const state = editor.getNodeEditState()
  if (!state) throw new Error('not editing')
  expect(
    shownHandles(state).map(({ segmentIndex, tangentField }) => [segmentIndex, tangentField])
  ).toEqual([
    [0, 'tangentEnd'],
    [1, 'tangentStart']
  ])
})

test('picks the handle drawn on top where two overlap', () => {
  setup()
  expect(hitTestEditHandle(editor, 60, 40)).toEqual({
    segmentIndex: 1,
    tangentField: 'tangentStart',
    vertexIndex: 1
  })
})
