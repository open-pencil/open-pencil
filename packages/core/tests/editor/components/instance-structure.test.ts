import { describe, expect, test } from 'bun:test'
import { compact } from 'es-toolkit'

import { createEditor, type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

// Each case repeats a Figma desktop 126 script: the instance mirrors the component's new
// structure, and a moved layer keeps its copy and the copy's overrides.

/** Component sync runs after the edit, in a microtask. */
const synced = () => Promise.resolve()

function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const node = (type: SceneNode['type'], parentId: string, props: Partial<SceneNode> = {}) =>
    editor.graph.createNode(type, parentId, { width: 40, height: 20, ...props })
  /** The instance's tree, with each text's characters. */
  const tree = (id: string): string => {
    const n = editor.graph.getNode(id)
    if (!n) return ''
    const label = n.type === 'TEXT' ? `${n.name}("${n.text}")` : n.name
    const children = compact(n.childIds.map(tree))
    return children.length > 0 ? `${label}[${children.join(' ')}]` : label
  }
  const copyOf = (instance: SceneNode, layer: SceneNode): SceneNode => {
    const find = (id: string): SceneNode | undefined => {
      const n = editor.graph.getNode(id)
      if (n?.componentId === layer.id) return n
      return n?.childIds.map(find).find(Boolean)
    }
    const found = find(instance.id)
    if (!found) throw new Error(`no copy of ${layer.name}`)
    return found
  }
  return { editor, page, node, tree, copyOf }
}

async function instanceOf(editor: Editor, componentId: string) {
  const instance = editor.graph.createInstance(componentId, editor.state.currentPageId)
  if (!instance) throw new Error('no instance')
  await synced()
  return instance
}

describe('an instance follows its component’s structure', () => {
  test('wrapping a layer in auto layout keeps its copy and override, through undo', async () => {
    const { editor, page, node, tree, copyOf } = setup()
    const button = node('COMPONENT', page, { name: 'Button', width: 120, height: 40 })
    const badge = node('FRAME', button.id, { name: 'Badge' })
    const number = node('TEXT', badge.id, { name: 'Number', text: '1' })
    const instance = await instanceOf(editor, button.id)
    editor.updateNodeWithUndo(copyOf(instance, number).id, { text: '9' })
    await synced()

    editor.select([badge.id])
    editor.wrapInAutoLayout()
    await synced()
    expect(tree(instance.id)).toBe('Button[Frame[Badge[Number("9")]]]')
    editor.undoAction()
    await synced()
    expect(tree(instance.id)).toBe('Button[Badge[Number("9")]]')
  })

  test('a layer moved into a sibling frame takes its copy along', async () => {
    const { editor, page, node, tree, copyOf } = setup()
    const tag = node('COMPONENT', page, { name: 'Tag' })
    const badge = node('FRAME', tag.id, { name: 'Badge' })
    const number = node('TEXT', tag.id, { name: 'Number', text: '1' })
    const instance = await instanceOf(editor, tag.id)
    const copy = copyOf(instance, number)
    editor.updateNodeWithUndo(copy.id, { text: '7' })
    editor.reorderChildWithUndo(number.id, badge.id, 0)
    await synced()
    expect(tree(instance.id)).toBe('Tag[Badge[Number("7")]]')
    expect(copyOf(instance, number).id).toBe(copy.id)
  })

  test('a layer moved out of the component leaves the instance, and comes back on undo', async () => {
    const { editor, page, node, tree, copyOf } = setup()
    const card = node('COMPONENT', page, { name: 'Card' })
    const title = node('TEXT', card.id, { name: 'Title', text: 'Hello' })
    const instance = await instanceOf(editor, card.id)
    editor.updateNodeWithUndo(copyOf(instance, title).id, { text: 'Override' })
    editor.reorderChildWithUndo(title.id, page, 0)
    await synced()
    expect(tree(instance.id)).toBe('Card')
    editor.undoAction()
    await synced()
    expect(tree(instance.id)).toBe('Card[Title("Override")]')
  })

  test('a layer moved into the component appears in the instance', async () => {
    const { editor, page, node, tree } = setup()
    const chip = node('COMPONENT', page, { name: 'Chip' })
    node('TEXT', chip.id, { name: 'Label', text: 'A' })
    const instance = await instanceOf(editor, chip.id)
    const extra = node('TEXT', page, { name: 'Extra', text: 'B' })
    editor.reorderChildWithUndo(extra.id, chip.id, 1)
    await synced()
    expect(tree(instance.id)).toBe('Chip[Label("A") Extra("B")]')
  })

  test('a deleted layer leaves the instance, and undo brings back its override', async () => {
    const { editor, page, node, tree, copyOf } = setup()
    const list = node('COMPONENT', page, { name: 'List' })
    const a = node('TEXT', list.id, { name: 'A', text: 'a' })
    node('TEXT', list.id, { name: 'B', text: 'b' })
    const instance = await instanceOf(editor, list.id)
    editor.updateNodeWithUndo(copyOf(instance, a).id, { text: 'override' })
    editor.select([a.id])
    editor.deleteSelected()
    await synced()
    expect(tree(instance.id)).toBe('List[B("b")]')
    editor.undoAction()
    await synced()
    expect(tree(instance.id)).toBe('List[A("override") B("b")]')
    editor.redoAction()
    await synced()
    expect(tree(instance.id)).toBe('List[B("b")]')
  })
})
