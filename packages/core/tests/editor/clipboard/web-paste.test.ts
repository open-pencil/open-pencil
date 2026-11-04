import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type {
  DesignElement,
  DesignLayout,
  DesignNode,
  DesignStyleDeclaration
} from '@open-pencil/dom-css'

function element(
  computedStyle: DesignStyleDeclaration,
  layout: DesignLayout,
  children: DesignNode[] = []
): DesignElement {
  return { type: 'element', tagName: 'div', attrs: {}, children, computedStyle, layout }
}

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

describe('pasting text from outside', () => {
  test('makes one text layer sized to it, centred on the point, as one undo entry', async () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const id = await editor.pasteText('Design without lock-in', 500, 300)

    const [text] = editor.graph.getChildren(pageId)
    expect(text).toMatchObject({ id, type: 'TEXT', text: 'Design without lock-in' })
    expect(text.name).toBe('Design without lock-in')
    expect(text.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(text.width).toBeGreaterThan(0)
    expect(text.x + text.width / 2).toBeCloseTo(500, 0)
    expect(text.y + text.height / 2).toBeCloseTo(300, 0)
    expect(editor.state.selectedIds).toEqual(new Set([text.id]))
    expect(editor.undo.undoLabel).toBe('Paste text')

    editor.undoAction()
    expect(editor.graph.getChildren(pageId)).toHaveLength(0)
  })

  test('keeps the links the copied page had', async () => {
    const editor = createEditor()

    const id = await editor.pasteText('Read the docs.', 0, 0, [
      { start: 9, length: 4, url: 'https://openpencil.dev' }
    ])

    expect(editor.graph.getNode(id ?? '')?.styleRuns).toEqual([
      {
        start: 9,
        length: 4,
        style: { hyperlink: { type: 'URL', value: 'https://openpencil.dev' } }
      }
    ])
  })

  test('pastes nothing for blank text', async () => {
    const editor = createEditor()
    expect(await editor.pasteText(' \n ', 0, 0)).toBeNull()
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(0)
  })
})

describe('pasting HTML as layers', () => {
  test('pastes the laid-out layers centred on the point, as one undo entry', async () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const card = element(
      { width: '200px', height: '100px', 'background-color': 'rgb(255, 0, 0)' },
      {
        box: rect(0, 0, 200, 100)
      }
    )

    expect(await editor.pasteStyledHTML({ type: 'document', children: [card] }, 500, 300)).toBe(
      true
    )

    const [layer] = editor.graph.getChildren(pageId)
    expect(layer).toMatchObject({ type: 'FRAME', x: 400, y: 250, width: 200, height: 100 })
    expect(editor.state.selectedIds.has(layer.id)).toBe(true)
    editor.undoAction()
    expect(editor.graph.getChildren(pageId)).toHaveLength(0)
  })

  test('lays HTML out at the width of the frame it is pasted into', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    expect(editor.htmlPasteWidth()).toBeNull()

    const frame = editor.graph.createNode('FRAME', pageId, {
      width: 360,
      height: 640,
      layoutMode: 'VERTICAL',
      paddingLeft: 16,
      paddingRight: 24
    })
    editor.select([frame.id])
    expect(editor.htmlPasteWidth()).toBe(320)
  })
})
