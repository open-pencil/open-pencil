import { describe, expect, test } from 'bun:test'

import { createEditor, documentKindRules } from '@open-pencil/core/editor'

describe('presentation fit and presentable rules', () => {
  function setupDeck(viewport: { width: number; height: number }) {
    const editor = createEditor({
      getViewportSize: () => viewport
    })
    editor.setDocumentKind('deck')
    const pageId = editor.graph.getPages()[0].id
    // Clear the empty deck starter if any; create a known 1920×1080 artboard.
    for (const child of editor.graph.getChildren(pageId)) {
      editor.graph.deleteNode(child.id)
    }
    editor.graph.createNode('FRAME', pageId, {
      name: 'Slide',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080
    })
    return editor
  }

  test('presentable is true for decks and false for design', () => {
    expect(documentKindRules('deck').presentable).toBe(true)
    expect(documentKindRules('design').presentable).toBe(false)
  })

  test('editing fit keeps padding and caps scale at 100%', () => {
    // Viewport larger than the slide — editing must not scale above 1.
    const editor = setupDeck({ width: 2400, height: 1600 })
    editor.state.presenting = false
    editor.zoomToFit()

    expect(editor.state.zoom).toBeLessThanOrEqual(1)
    // 80px padding on each side reduces usable space relative to edge-to-edge.
    const edgeScale = Math.min(2400 / 1920, 1600 / 1080)
    expect(editor.state.zoom).toBeLessThan(edgeScale)
  })

  test('presentation fit drops padding and scales above 100% on a larger viewport', () => {
    const editor = setupDeck({ width: 2400, height: 1600 })
    editor.state.presenting = true
    editor.zoomToFit()

    const expected = Math.min(2400 / 1920, 1600 / 1080)
    expect(editor.state.zoom).toBeCloseTo(expected, 5)
    expect(editor.state.zoom).toBeGreaterThan(1)
  })

  test('presentation fit scales down without padding on a smaller viewport', () => {
    const editor = setupDeck({ width: 960, height: 540 })
    editor.state.presenting = true
    editor.zoomToFit()

    expect(editor.state.zoom).toBeCloseTo(0.5, 5)
  })

  test('default EditorState starts with presenting false', () => {
    const editor = createEditor()
    expect(editor.state.presenting).toBe(false)
  })
})
