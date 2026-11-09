import { describe, expect, test } from 'bun:test'

import type { Variable } from '@open-pencil/scene-graph'
import { parseVariableFormula } from '@open-pencil/scene-graph/variables'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

import type { EditorStore } from '@/app/editor/session'

import { BLUE, GREEN, RED, withRoom } from '#tests/helpers/collab/theme-room'

function brandOf(store: EditorStore, id: string): Variable {
  return expectDefined(store.graph.variables.get(id), 'Brand')
}

describe('variables in a room', () => {
  test('formula definitions and edits to their dependencies reach both peers', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      const base = host.graph.createVariable('space/base', 'FLOAT', ids.collection, 4)
      const gap = host.graph.createVariable('space/gap', 'FLOAT', ids.collection, 8)
      const enabled = host.graph.createVariable('enabled', 'BOOLEAN', ids.collection, true)
      const visible = host.graph.createVariable('visible', 'BOOLEAN', ids.collection, false)
      host.updateVariableValue(
        gap.id,
        ids.light,
        parseVariableFormula(host.graph, gap.id, ids.light, '{space/base} * 2').value
      )
      host.updateVariableValue(
        visible.id,
        ids.light,
        parseVariableFormula(host.graph, visible.id, ids.light, 'NOT {enabled}').value
      )
      await settle()
      expect(guest.graph.resolveVariable(gap.id)).toBe(8)
      expect(guest.graph.resolveVariable(visible.id)).toBe(false)
      guest.updateVariableValue(base.id, ids.light, 6)
      guest.updateVariableValue(enabled.id, ids.light, false)
      await settle()
      for (const store of [host, guest]) {
        expect(store.graph.resolveVariable(gap.id)).toBe(12)
        expect(store.graph.resolveVariable(visible.id)).toBe(true)
      }
    })
  })

  test('a joined tab receives the collections, modes, and values of the shared document', async () => {
    await withRoom(async ({ guest, ids }) => {
      const collection = expectDefined(guest.graph.variableCollections.get(ids.collection), 'Theme')
      expect(collection.name).toBe('Theme')
      expect(collection.modes.map((mode) => mode.name)).toEqual(['Mode 1', 'Dark'])
      expect(collection.variableIds).toEqual([ids.brand])
      expect(brandOf(guest, ids.brand).valuesByMode).toEqual({
        [ids.light]: RED,
        [ids.dark]: BLUE
      })
    })
  })

  test('an edited value reaches the other tab, where the layers bound to it draw it', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      host.updateVariableValue(ids.brand, ids.light, GREEN)
      await settle()
      expect(brandOf(guest, ids.brand).valuesByMode[ids.light]).toEqual(GREEN)
      // The renderer resolves a bound color as it draws the layer.
      const card = getNodeOrThrow(guest.graph, ids.card)
      expect(guest.graph.resolveColorVariableForNode(card.id, ids.brand)).toEqual(GREEN)
    })
  })

  test('two people editing different modes of one variable both keep their change', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      host.updateVariableValue(ids.brand, ids.light, GREEN)
      guest.updateVariableValue(ids.brand, ids.dark, RED)
      await settle()
      for (const store of [host, guest]) {
        expect(brandOf(store, ids.brand).valuesByMode).toEqual({
          [ids.light]: GREEN,
          [ids.dark]: RED
        })
      }
    })
  })

  test('two people adding variables at once both find theirs in the collection', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      const make = (store: EditorStore, name: string) => {
        const variable = store.graph.createVariable(name, 'COLOR', ids.collection, RED)
        // Created through the graph, it is registered already; the editor action records it.
        store.graph.variables.delete(variable.id)
        const collection = expectDefined(store.graph.variableCollections.get(ids.collection), 'c')
        collection.variableIds = collection.variableIds.filter((id) => id !== variable.id)
        store.addVariable(variable)
        return variable.id
      }
      const accent = make(host, 'Accent')
      const muted = make(guest, 'Muted')
      await settle()
      const lists = [host, guest].map(
        (store) =>
          expectDefined(store.graph.variableCollections.get(ids.collection), 'c').variableIds
      )
      expect(lists[0]).toEqual(lists[1])
      expect(new Set(lists[0])).toEqual(new Set([ids.brand, accent, muted]))
    })
  })

  test('an undo reaches the other tab', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      host.renameVariable(ids.brand, 'Primary')
      await settle()
      expect(brandOf(guest, ids.brand).name).toBe('Primary')
      host.undoAction()
      await settle()
      expect(brandOf(guest, ids.brand).name).toBe('Brand')
    })
  })

  test('a removed collection is removed for everyone, with its variables', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      host.removeCollection(ids.collection)
      await settle()
      expect(guest.graph.variableCollections.has(ids.collection)).toBe(false)
      expect(guest.graph.variables.has(ids.brand)).toBe(false)
    })
  })

  test('an edit not yet in the history still reaches the room when a peer’s edit lands first', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      // A plugin script changes the graph at once and records its undo step when it ends.
      const theme = expectDefined(host.graph.variableCollections.get(ids.collection), 'Theme')
      theme.name = 'Palette'
      guest.updateVariableValue(ids.brand, ids.light, GREEN)
      await settle()
      host.updateVariableValue(ids.brand, ids.dark, GREEN)
      await settle()
      expect(guest.graph.variableCollections.get(ids.collection)?.name).toBe('Palette')
    })
  })
})
