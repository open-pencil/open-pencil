import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

describe('owned node previews', () => {
  test('publishes layout children with their layout provenance and preserves one-step undo', () => {
    const editor = createEditor()
    try {
      const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        width: 200,
        height: 100,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED'
      })
      const child = editor.graph.createNode('RECTANGLE', parent.id, { layoutGrow: 1, height: 20 })
      editor.runLayoutForNode(parent.id)
      const updates: Array<{ id: string; changes: Partial<SceneNode>; layout: boolean }> = []
      editor.onEditorEvent('node:updated', (id, changes) => {
        updates.push({ id, changes, layout: editor.graph.isApplyingLayout })
      })
      const preview = editor.beginNodePreview('Resize')
      expect(editor.isInteractiveEditing()).toBe(false)
      preview.update(parent.id, { width: 320 })
      preview.update(parent.id, { width: 340 })
      expect(updates).toEqual([])
      expect(editor.isInteractiveEditing()).toBe(true)
      preview.commit()
      expect(editor.isInteractiveEditing()).toBe(false)
      expect(updates.find((update) => update.id === child.id)).toMatchObject({
        changes: { width: 340 },
        layout: true
      })
      expect(updates.filter((update) => update.id === child.id)).toHaveLength(1)
      editor.undoAction()
      expect([parent.width, child.width]).toEqual([200, 200])
      expect(editor.undo.canUndo).toBe(false)
      editor.redoAction()
      expect([parent.width, child.width]).toEqual([340, 340])
    } finally {
      editor.dispose()
    }
  })

  test('captures implicit style detachment and text-cache invalidation for commit, undo and cancel', () => {
    const editor = createEditor()
    try {
      const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
        text: 'Preview',
        fontSize: 16,
        textStyleId: 'linked-style',
        derivedTextGlyphs: [],
        textPicture: new Uint8Array([1, 2, 3])
      })
      const updates: Partial<SceneNode>[] = []
      editor.onEditorEvent('node:updated', (id, changes) => {
        if (id === node.id) updates.push(changes)
      })
      const preview = editor.beginNodePreview('Font size')
      preview.update(node.id, { fontSize: 32 })
      expect(updates).toEqual([])
      expect(node.textStyleId).toBeNull()
      preview.commit()
      expect(updates[0]).toMatchObject({
        fontSize: 32,
        textStyleId: null,
        derivedTextGlyphs: null,
        textPicture: null
      })
      editor.undoAction()
      expect(node.fontSize).toBe(16)
      expect(node.textStyleId).toBe('linked-style')
      expect(node.derivedTextGlyphs).toEqual([])
      expect(node.textPicture).toEqual(new Uint8Array([1, 2, 3]))
      const count = updates.length
      const cancelled = editor.beginNodePreview()
      cancelled.update(node.id, { fontSize: 48 })
      cancelled.cancel()
      expect(updates).toHaveLength(count)
      expect(node.fontSize).toBe(16)
      expect(node.textStyleId).toBe('linked-style')
      expect(node.derivedTextGlyphs).toEqual([])
    } finally {
      editor.dispose()
    }
  })

  for (const terminal of ['selection', 'replacement', 'disposal'] as const) {
    test(`${terminal} cancels the old edit and ignores its trailing input`, () => {
      const editor = createEditor()
      try {
        const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 10 })
        const preview = editor.beginNodePreview()
        preview.update(node.id, { x: 50 })
        if (terminal === 'selection') editor.select([node.id])
        if (terminal === 'replacement') editor.replaceGraph(new SceneGraph())
        if (terminal === 'disposal') editor.dispose()
        expect(preview.closed).toBe(true)
        expect(node.x).toBe(10)
        preview.update(node.id, { x: 90 })
        preview.commit()
        expect(node.x).toBe(10)
        expect(editor.undo.canUndo).toBe(false)
        expect(editor.isInteractiveEditing()).toBe(false)
      } finally {
        editor.dispose()
      }
    })
  }

  test('deleting an unchanged target cancels the other targets without resurrecting it', () => {
    const editor = createEditor()
    try {
      const first = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 10 })
      const second = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 20 })
      const preview = editor.beginNodePreview()
      preview.update(first.id, { x: 10 })
      preview.update(second.id, { x: 30 })
      editor.graph.deleteNode(first.id)
      expect(preview.closed).toBe(true)
      expect(editor.graph.getNode(first.id)).toBeUndefined()
      expect(second.x).toBe(20)
      expect(editor.isInteractiveEditing()).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('preview observers unwind after exceptions and include nested layout updates', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, { x: 10 })
    const previous: number[] = []
    expect(() =>
      graph.runPreviewUpdates(
        () => {
          graph.runPreviewUpdates(() => graph.updateNode(node.id, { x: 20 }))
          throw new Error('Interrupted preview')
        },
        (before) => {
          previous.push(before.x)
        }
      )
    ).toThrow('Interrupted preview')
    graph.runPreviewUpdates(() => graph.updateNode(node.id, { x: 30 }))
    expect(previous).toEqual([10])
  })

  test('history batches are not live interactions and interaction release is idempotent', () => {
    const editor = createEditor()
    try {
      editor.undo.beginBatch('Programmatic work')
      expect(editor.isInteractiveEditing()).toBe(false)
      const endFirst = editor.beginInteractiveEdit()
      const endSecond = editor.beginInteractiveEdit()
      endFirst()
      endFirst()
      expect(editor.isInteractiveEditing()).toBe(true)
      endSecond()
      expect(editor.isInteractiveEditing()).toBe(false)
      editor.undo.commitBatch()
    } finally {
      editor.dispose()
    }
  })

  test('rejects library-definition previews without leaving an active edit', () => {
    const editor = createEditor()
    try {
      const node = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
        x: 10,
        librarySource: {
          identity: { libraryId: 'design-system', assetKey: 'button', revisionId: 'r1' },
          sourceNodeId: 'source',
          readOnly: true
        }
      })
      const preview = editor.beginNodePreview()
      expect(() => preview.update(node.id, { x: 30 })).toThrow('Edit the source library')
      expect(preview.closed).toBe(true)
      expect(node.x).toBe(10)
      expect(editor.isInteractiveEditing()).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('unchanged terminal commits do not add history for non-preview controls', () => {
    const editor = createEditor()
    try {
      const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { opacity: 1 })
      editor.commitNodeUpdate(node.id, { opacity: 1 })
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('returning to the original value closes without an undo entry', () => {
    const editor = createEditor()
    try {
      const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 10 })
      const preview = editor.beginNodePreview()
      preview.update(node.id, { x: 40 })
      preview.update(node.id, { x: 10 })
      preview.commit()
      expect(preview.closed).toBe(true)
      expect(editor.undo.canUndo).toBe(false)
      expect(editor.isInteractiveEditing()).toBe(false)
    } finally {
      editor.dispose()
    }
  })
})
