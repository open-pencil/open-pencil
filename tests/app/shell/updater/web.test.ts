import { afterEach, describe, expect, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { toast } from '@/app/shell/ui'
import { offerWebUpdate } from '@/app/shell/updater/web'

const { updates: messages } = useI18n()

afterEach(() => {
  for (const entry of toast.toasts.value) toast.remove(entry.id)
})

function offered(options: { agrees?: boolean; dirty?: boolean; hidden?: boolean } = {}) {
  const hidden = ref(options.hidden ?? false)
  const dirty = ref(options.dirty ?? false)
  let reloads = 0
  let asked = 0
  offerWebUpdate({
    reload: () => {
      reloads++
    },
    confirm: async () => {
      asked++
      return options.agrees ?? true
    },
    hasUnkeptEdits: () => dirty.value,
    hidden: () => hidden.value
  })
  const offer = toast.toasts.value.find((entry) => entry.message === messages.value.webUpdateReady)
  return { offer, hidden, dirty, reloads: () => reloads, asked: () => asked }
}

describe('web updates', () => {
  test('offer the new version instead of reloading the editor', () => {
    const { offer, reloads } = offered()
    expect(offer?.action?.label).toBe(messages.value.reload)
    expect(reloads()).toBe(0)
  })

  test('reload once unsaved documents are settled, as the desktop restart asks', async () => {
    const agreed = offered()
    agreed.offer?.action?.run(agreed.offer.id)
    await Promise.resolve()
    expect([agreed.asked(), agreed.reloads()]).toEqual([1, 1])

    for (const entry of toast.toasts.value) toast.remove(entry.id)
    const declined = offered({ agrees: false })
    declined.offer?.action?.run(declined.offer.id)
    await Promise.resolve()
    expect([declined.asked(), declined.reloads()]).toEqual([1, 0])
  })

  test('reload a page in the background only while nothing is unsaved', async () => {
    const { hidden, dirty, reloads } = offered({ dirty: true })
    hidden.value = true
    await nextTick()
    expect(reloads()).toBe(0)
    dirty.value = false
    await nextTick()
    expect(reloads()).toBe(1)
    // Coming back and leaving again does not load it twice.
    hidden.value = false
    await nextTick()
    hidden.value = true
    await nextTick()
    expect(reloads()).toBe(1)
  })
})
