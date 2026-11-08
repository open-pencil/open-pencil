import { describe, expect, test } from 'bun:test'

import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

import type { EditorStore } from '@/app/editor/session'

import { GREEN, RED, withRoom } from '#tests/helpers/collab/theme-room'

function cardOf(store: EditorStore, id: string) {
  return getNodeOrThrow(store.graph, id)
}

function lightBrand(store: EditorStore, brand: string, light: string) {
  return expectDefined(store.graph.variables.get(brand), 'Brand').valuesByMode[light]
}

describe('an agent editing a shared document', () => {
  test('a collaborator’s edit made while the agent waits on a download stays out of its undo step', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      const width = cardOf(host, ids.card).width
      const download = Promise.withResolvers<undefined>()
      const edit = host.recordEditAsync({ label: 'Agent: eval' }, async () => {
        host.graph.updateNode(ids.card, { x: 10 })
        await host.graph.waitOutsideEdit(download.promise)
        host.graph.updateNode(ids.card, { width: 50 })
      })
      await settle()

      // The collaborator moves the same card and changes a color while the agent waits.
      guest.recordEdit({ label: 'Move' }, () => guest.graph.updateNode(ids.card, { y: 30 }))
      guest.updateVariableValue(ids.brand, ids.light, GREEN)
      await settle()
      download.resolve(undefined)
      await edit
      await settle()
      expect(cardOf(guest, ids.card)).toMatchObject({ x: 10, y: 30, width: 50 })

      expect(host.undo.undo()).toBe('Agent: eval')
      await settle()
      for (const store of [host, guest]) {
        expect(cardOf(store, ids.card)).toMatchObject({ x: 0, y: 30, width })
        expect(lightBrand(store, ids.brand, ids.light)).toEqual(GREEN)
      }
    })
  })

  test('a failed agent edit is rolled back for the collaborator, even what was already sent', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      const download = Promise.withResolvers<undefined>()
      const edit = host.recordEditAsync({ label: 'Agent: eval' }, async () => {
        host.graph.updateNode(ids.card, { x: 10 })
        const brand = expectDefined(host.graph.variables.get(ids.brand), 'Brand')
        host.graph.willChangeVariable(ids.brand)
        brand.valuesByMode = { ...brand.valuesByMode, [ids.light]: GREEN }
        await host.graph.waitOutsideEdit(download.promise)
        throw new Error('The script failed')
      })
      // The user's own edit meanwhile sends the room the agent's values so far.
      host.recordEdit({ label: 'Rename' }, () => host.graph.updateNode(ids.card, { name: 'Hero' }))
      await settle()
      expect(cardOf(guest, ids.card).x).toBe(10)
      expect(lightBrand(guest, ids.brand, ids.light)).toEqual(GREEN)

      download.resolve(undefined)
      await expect(edit).rejects.toThrow('The script failed')
      await settle()
      for (const store of [host, guest]) {
        expect(cardOf(store, ids.card)).toMatchObject({ x: 0, name: 'Hero' })
        expect(lightBrand(store, ids.brand, ids.light)).toEqual(RED)
      }
    })
  })

  // A known gap: only the API's own waits (fonts, images, pages) keep others' edits out of a
  // script's step. A script's own `fetch` or timer does not.
  test('a collaborator’s edit made while a script waits on its own fetch is undone with the script', async () => {
    await withRoom(async ({ host, guest, settle, ids }) => {
      const response = Promise.withResolvers<undefined>()
      const edit = host.recordEditAsync({ label: 'Agent: eval' }, async () => {
        host.graph.updateNode(ids.card, { x: 10 })
        await response.promise
      })
      await settle()
      guest.recordEdit({ label: 'Move' }, () => guest.graph.updateNode(ids.card, { y: 30 }))
      await settle()
      response.resolve(undefined)
      await edit

      expect(host.undo.undo()).toBe('Agent: eval')
      await settle()
      for (const store of [host, guest]) {
        expect(cardOf(store, ids.card)).toMatchObject({ x: 0, y: 0 })
      }
    })
  })
})
