import { afterEach, describe, expect, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { toast } from '@/app/shell/ui'
import { offerWebUpdate, takeWebUpdate } from '@/app/shell/updater/web'

const { updates: messages } = useI18n()

afterEach(() => {
  for (const entry of toast.toasts.value) toast.remove(entry.id)
})

function offered(
  options: { agrees?: boolean; dirty?: boolean; hidden?: boolean; overlay?: boolean } = {}
) {
  const hidden = ref(options.hidden ?? false)
  const dirty = ref(options.dirty ?? false)
  const overlay = ref(options.overlay ?? false)
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
    overlayOpen: () => overlay.value,
    hidden: () => hidden.value
  })
  const offer = toast.toasts.value.find((entry) => entry.message === messages.value.webUpdateReady)
  return { offer, hidden, dirty, overlay, reloads: () => reloads, asked: () => asked }
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

  test('leave a page in the background alone while a dialog may hold a draft', async () => {
    const { hidden, overlay, reloads } = offered({ overlay: true })
    hidden.value = true
    await nextTick()
    expect(reloads()).toBe(0)
    overlay.value = false
    await nextTick()
    expect(reloads()).toBe(1)
  })

  test('offer the new version again when the page is shown again', async () => {
    const { hidden } = offered({ dirty: true })
    for (const entry of toast.toasts.value) toast.remove(entry.id)
    hidden.value = true
    await nextTick()
    hidden.value = false
    await nextTick()
    expect(toast.toasts.value.map((entry) => entry.message)).toEqual([
      messages.value.webUpdateReady
    ])
  })

  test('wait with Reload while a dialog may hold a draft', async () => {
    const { offer, overlay, asked, reloads } = offered({ overlay: true })
    offer?.action?.run(offer.id)
    await Promise.resolve()
    expect([asked(), reloads()]).toEqual([0, 0])
    overlay.value = false
    offer?.action?.run(offer.id)
    await Promise.resolve()
    expect([asked(), reloads()]).toEqual([1, 1])
  })
})

/** A version waiting to take over, which the test activates by hand. */
class WaitingWorker extends EventTarget {
  state: ServiceWorkerState = 'installed'

  activated() {
    this.state = 'activated'
    this.dispatchEvent(new Event('statechange'))
  }
}

function taking(controlled: boolean, waiting: WaitingWorker | null) {
  const calls: string[] = []
  takeWebUpdate({
    controlled,
    waiting,
    activate: () => calls.push('activate'),
    reload: () => calls.push('reload')
  })
  return calls
}

describe('taking a web update', () => {
  test('leaves a page the old worker controls to reload once the new one takes over', () => {
    expect(taking(true, new WaitingWorker())).toEqual(['activate'])
  })

  test('reloads a page no worker controlled once the new version is active', () => {
    const waiting = new WaitingWorker()
    const calls = taking(false, waiting)
    expect(calls).toEqual(['activate'])
    waiting.activated()
    expect(calls).toEqual(['activate', 'reload'])
  })

  test('reloads a page no worker controlled at once when nothing is left waiting', () => {
    expect(taking(false, null)).toEqual(['reload'])
  })
})
