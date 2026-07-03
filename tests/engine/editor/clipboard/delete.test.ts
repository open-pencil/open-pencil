import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { computeAllLayouts } from '@open-pencil/core/layout'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, rect } from '#tests/helpers/layout'

describe('deleteSelected', () => {
  test('reflows fixed vertical auto-layout siblings', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const frame = autoFrame(editor.graph, page, {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 300,
      itemSpacing: 0
    })
    rect(editor.graph, frame.id, 300, 40)
    const body = rect(editor.graph, frame.id, 300, 100, { layoutGrow: 1 })
    const footerA = rect(editor.graph, frame.id, 300, 40)
    const footerB = rect(editor.graph, frame.id, 300, 40)
    computeAllLayouts(editor.graph, page)

    editor.select([footerB.id])
    editor.deleteSelected()

    expect(getNodeOrThrow(editor.graph, body.id).height).toBe(220)
    expect(getNodeOrThrow(editor.graph, footerA.id).y).toBe(260)
  })
})
