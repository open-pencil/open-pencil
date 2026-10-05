import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

// Each case matches Cmd+D or Cmd+V observed in Figma desktop 126.

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor({ getViewportSize: () => ({ width: 800, height: 600 }) })
  return editor.state.currentPageId
}

function node(type: SceneNode['type'], parentId: string, props: Partial<SceneNode> = {}) {
  return editor.graph.createNode(type, parentId, { width: 40, height: 40, ...props })
}

function selected() {
  const [id] = editor.state.selectedIds
  const found = editor.graph.getNode(id)
  if (!found) throw new Error('Expected a selected layer')
  return found
}

async function copy(id: string) {
  editor.select([id])
  const payload = await editor.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  return payload.snapshot
}

describe('duplicate placement', () => {
  test('duplicates a layer on top of the original', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 200 })
    for (const original of [node('RECTANGLE', page, { x: 100, y: 100 }), node('FRAME', frame.id, { x: 50, y: 50 })]) {
      editor.select([original.id])
      editor.duplicateSelected()
      expect(selected()).toMatchObject({ parentId: original.parentId, x: original.x, y: original.y })
    }
  })

  test('puts a duplicated top-level frame in the first free place to its right', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 150 })
    editor.select([frame.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ x: 240, y: 0 })
  })

  test('skips past top-level layers in the way', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 150 })
    node('FRAME', page, { x: 250, width: 100, height: 100 })
    editor.select([frame.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ x: 390, y: 0 })
  })

  test('treats a frame in a section as top-level', () => {
    const page = setup()
    const section = node('SECTION', page, { width: 600, height: 300 })
    node('FRAME', section.id, { x: 140, y: 50, width: 100, height: 100 })
    const frame = node('FRAME', section.id, { x: 20, y: 50, width: 100, height: 100 })
    editor.select([frame.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ parentId: section.id, x: 280, y: 50 })
  })

  test('duplicates a multi-selection in place, keeping names', () => {
    const page = setup()
    const a = node('FRAME', page, { name: 'A', width: 100, height: 100 })
    const b = node('FRAME', page, { name: 'B', x: 140, width: 100, height: 100 })
    editor.select([a.id, b.id])
    editor.duplicateSelected()
    const copies = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
    expect(copies.map((n) => [n?.name, n?.x, n?.y])).toEqual([
      ['A', 0, 0],
      ['B', 140, 0]
    ])
  })

  test('duplicates a main component as an instance, but a variant as a variant', () => {
    const page = setup()
    const component = node('COMPONENT', page, { name: 'C', width: 100, height: 100 })
    editor.select([component.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ type: 'INSTANCE', componentId: component.id, name: 'C' })

    const set = node('COMPONENT_SET', page, { y: 300, width: 300, height: 140 })
    const variant = node('COMPONENT', set.id, { name: 'v=a', width: 60, height: 60 })
    editor.select([variant.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ type: 'COMPONENT', parentId: set.id })
  })
})

describe('paste placement', () => {
  test('keeps the offset a layer had inside its frame', async () => {
    const page = setup()
    const source = node('FRAME', page, { width: 200, height: 200 })
    const box = node('RECTANGLE', source.id, { x: 20, y: 30 })
    const target = node('FRAME', page, { x: 300, width: 200, height: 200 })
    const snapshot = await copy(box.id)
    editor.select([target.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: target.id, x: 20, y: 30 })
  })

  test('centers each axis that does not fit in the frame', async () => {
    const page = setup()
    const source = node('FRAME', page, { width: 200, height: 200 })
    const box = node('RECTANGLE', source.id, { x: 150, y: 150 })
    const target = node('FRAME', page, { x: 300, width: 100, height: 100 })
    const snapshot = await copy(box.id)
    editor.select([target.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: target.id, x: 30, y: 30 })
  })

  test('keeps the canvas position of a top-level layer', async () => {
    const page = setup()
    const box = node('RECTANGLE', page, { x: 20, y: 30 })
    const target = node('FRAME', page, { x: 300, width: 200, height: 200 })
    const leaf = node('RECTANGLE', target.id, { x: 100, y: 100 })
    const snapshot = await copy(box.id)
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: page, x: 20, y: 30 })

    // Inside a frame its x falls outside, so only x is centered.
    editor.select([leaf.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: target.id, x: 80, y: 30 })
  })

  test('centers layers that would land out of view', async () => {
    const page = setup()
    const box = node('RECTANGLE', page, { x: 5000, y: 5000 })
    const snapshot = await copy(box.id)
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: page, x: 380, y: 280 })
  })

  test('Paste here centers on the cursor inside the target frame', async () => {
    const page = setup()
    const box = node('RECTANGLE', page)
    const target = node('FRAME', page, { x: 300, y: 100, width: 200, height: 200 })
    const snapshot = await copy(box.id)
    editor.select([target.id])
    await editor.pasteSnapshot(snapshot, { x: 400, y: 200 })
    expect(selected()).toMatchObject({ parentId: target.id, x: 80, y: 80 })
  })
})
