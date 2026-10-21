import { afterEach, beforeEach, expect, test, vi } from 'bun:test'

import * as layoutModule from '@open-pencil/core/layout'

import { toast } from '@/app/shell/ui'
import { createTab, getActiveStore, getTabsSnapshot } from '@/app/tabs'
import { lastSession } from '@/app/tabs/open/last-session'
import { reopenLastSession } from '@/app/tabs/open/startup'

beforeEach(() => {
  Reflect.defineProperty(globalThis, 'window', {
    value: {
      innerWidth: 1024,
      innerHeight: 768,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 0
      },
      cancelAnimationFrame: vi.fn(),
      openPencil: {},
      location: { href: 'http://localhost/' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    configurable: true,
    writable: true
  })
  Reflect.defineProperty(globalThis, 'document', {
    value: { fonts: { add: vi.fn(), ready: Promise.resolve() } },
    configurable: true,
    writable: true
  })
  vi.spyOn(layoutModule, 'computeAllLayouts').mockReturnValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  lastSession.value = null
  // The notice is app-wide state; leaving it would show up in unrelated tests.
  for (const entry of toast.toasts.value) toast.remove(entry.id)
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
})

test('a saved design that cannot reopen leaves the Home tab in front', async () => {
  createTab()
  // A file path only opens in the desktop app, so this design cannot reopen here.
  lastSession.value = { documents: [{ kind: 'local', path: '/gone/design.fig' }], active: 0 }
  vi.spyOn(console, 'warn').mockReturnValue(undefined)

  await reopenLastSession({
    sharedFile: 'Shared file',
    reopenIncomplete: 'Some designs could not open'
  })

  const home = getTabsSnapshot().filter((tab) => tab.kind === 'home')
  expect(home).toHaveLength(1)
  expect(getActiveStore()).toBe(home[0]?.store)
})
