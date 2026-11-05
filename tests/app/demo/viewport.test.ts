import { expect, spyOn, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { showFirstChapter } from '@/app/demo/viewport'

test('zooms to the topmost section with air around it', () => {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  editor.graph.createNode('SECTION', pageId, {
    name: '2 · Later',
    x: 0,
    y: 2000,
    width: 800,
    height: 600
  })
  editor.graph.createNode('SECTION', pageId, {
    name: '1 · First',
    x: 100,
    y: 50,
    width: 1000,
    height: 700
  })
  editor.graph.createNode('FRAME', pageId, {
    name: 'Loose',
    x: -500,
    y: -500,
    width: 10,
    height: 10
  })
  const zoom = spyOn(editor, 'zoomToBounds')
  try {
    showFirstChapter(editor)
    expect(zoom).toHaveBeenCalledWith(20, -30, 1180, 830)
  } finally {
    zoom.mockRestore()
    editor.dispose()
  }
})

test('leaves the view alone on a page without sections', () => {
  const editor = createEditor()
  editor.graph.createNode('FRAME', editor.state.currentPageId, { width: 10, height: 10 })
  const zoom = spyOn(editor, 'zoomToBounds')
  try {
    showFirstChapter(editor)
    expect(zoom).not.toHaveBeenCalled()
  } finally {
    zoom.mockRestore()
    editor.dispose()
  }
})
