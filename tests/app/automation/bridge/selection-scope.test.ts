import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { limitToSelection } from '@/app/automation/bridge/selection-scope'
import { createEditorStore, type EditorStore } from '@/app/editor/session'

import { expectDefined } from '#tests/helpers/assert'

let store: EditorStore
let ids: { card: string; title: string; other: string }

beforeEach(() => {
  store = createEditorStore(new SceneGraph())
  const page = expectDefined(store.graph.getPages()[0], 'page').id
  const card = store.graph.createNode('FRAME', page, { name: 'Card', width: 200, height: 200 })
  const title = store.graph.createNode('TEXT', card.id, { name: 'Title', width: 100, height: 20 })
  const other = store.graph.createNode('FRAME', page, {
    name: 'Other',
    x: 300,
    width: 100,
    height: 100
  })
  ids = { card: card.id, title: title.id, other: other.id }
  store.select([card.id])
})

afterEach(() => {
  store.preparationController.dispose()
})

describe('limitToSelection', () => {
  test('lets a call reach the selected layers and what they hold', () => {
    expect(limitToSelection(store, 'get_node', { id: ids.title })).toEqual({ id: ids.title })
    expect(limitToSelection(store, 'get_page_tree', { root_id: ids.card })).toEqual({
      root_id: ids.card
    })
    expect(limitToSelection(store, 'get_selection', {})).toEqual({})
  })

  test('rejects nodes outside the selection', () => {
    expect(() => limitToSelection(store, 'get_node', { id: ids.other })).toThrow(/outside/)
    expect(() => limitToSelection(store, 'describe', { ids: [ids.title, ids.other] })).toThrow(
      /outside/
    )
  })

  test('reads the selection when a call names no nodes', () => {
    expect(limitToSelection(store, 'export_image', { scale: 2 })).toEqual({
      scale: 2,
      ids: [ids.card]
    })
    expect(limitToSelection(store, 'describe', {})).toEqual({ ids: [ids.card] })
    expect(() => limitToSelection(store, 'get_page_tree', {})).toThrow(/root_id/)
  })

  test('rejects writing an export to a file', () => {
    expect(() =>
      limitToSelection(store, 'export_image', { ids: [ids.card], path: 'card.png' })
    ).toThrow(/Writing files/)
  })

  test('rejects other tools and calls without a selection', () => {
    expect(() => limitToSelection(store, 'delete_node', { id: ids.title })).toThrow(/unavailable/)
    store.clearSelection()
    expect(() => limitToSelection(store, 'get_selection', {})).toThrow(/Nothing is selected/)
  })
})
