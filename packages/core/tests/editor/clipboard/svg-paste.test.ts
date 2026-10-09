import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

const BADGE = `<?xml version="1.0"?>
<svg id="badge" viewBox="0 0 40 20"><g id="dot"><circle cx="10" cy="10" r="10"/></g></svg>`

describe('pasting SVG markup', () => {
  test('places the layers centred on the point with one selection and undo entry', async () => {
    const editor = createEditor()

    expect(await editor.pasteSVG(BADGE, 200, 100)).toBe(true)

    const [frame] = editor.graph.getChildren(editor.state.currentPageId)
    expect(frame).toMatchObject({ type: 'FRAME', name: 'badge', x: 180, y: 90 })
    expect(editor.graph.getChildren(frame?.id ?? '').map((node) => node.name)).toEqual(['dot'])
    expect([...editor.state.selectedIds]).toEqual([frame?.id])
    expect(editor.undo.undoLabel).toBe('Paste SVG')

    editor.undoAction()
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(0)
  })

  test('leaves text that is not SVG to other paste handlers', async () => {
    const editor = createEditor()

    expect(await editor.pasteSVG('<p>not an svg</p>', 0, 0)).toBe(false)
    expect(await editor.pasteSVG('just text with <svg> in it', 0, 0)).toBe(false)
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(0)
  })
})
