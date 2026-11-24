import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import * as figModule from '@open-pencil/core/io/formats/fig'
import * as layoutModule from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { listAutomationDocuments } from '@/app/automation/bridge/target'
import { resolveBrowserFileURL } from '@/app/document/io/browser'
import type { DocumentSourceIdentity } from '@/app/document/io/types'
import { getRecoveryStore, resetRecoveryStoreForTests } from '@/app/document/recovery'
import { createMemoryRecoveryStore } from '@/app/document/recovery/memory'
import { appPreferences } from '@/app/settings/preferences/store'
import { toast } from '@/app/shell/ui'
import {
  closeTab,
  createHomeTab,
  createTab,
  getActiveStore,
  getTabsSnapshot,
  onTabDocumentReplaced,
  openFileInNewTab,
  showNewTab,
  restoreRecoverySnapshot,
  switchAdjacentTab,
  switchTab,
  tabCount,
  withHomePinned,
  type Tab
} from '@/app/tabs'
import { fileIdentitiesMatch, findTabByFileIdentity } from '@/app/tabs/open/identity'
function setupGlobals() {
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
  globalThis.requestAnimationFrame = window.requestAnimationFrame
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame
}

/** Stands in for each tab's canvas once its page waits to be shown. */
function presentPendingPages(present: (store: Tab['store']) => void): void {
  for (const tab of getTabsSnapshot()) {
    if (tab.store.state.preparation?.phase !== 'preparing-render') continue
    present(tab.store)
  }
}

function acknowledgePresentation(store: Tab['store']): void {
  store.preparationController.acknowledgePresentation(store.state)
}

type FileOpenOutcome = { status: 'fulfilled' } | { status: 'rejected'; reason: unknown }

async function settleFileOpen(
  opening: Promise<unknown>,
  present: (store: Tab['store']) => void = acknowledgePresentation
): Promise<void> {
  const outcome: Promise<FileOpenOutcome> = opening.then(
    () => ({ status: 'fulfilled' }),
    (reason: unknown) => ({ status: 'rejected', reason })
  )

  const awaitOutcome = async (): Promise<FileOpenOutcome> => {
    presentPendingPages(present)
    const result = await Promise.race([
      outcome,
      new Promise<null>((resolve) => {
        setTimeout(resolve, 0)
      })
    ])
    return result ?? awaitOutcome()
  }

  const result = await awaitOutcome()
  if (result.status === 'rejected') throw result.reason
}

function makeHandle(
  name: string,
  isSameEntry: (other: FileSystemFileHandle) => Promise<boolean>
): FileSystemFileHandle {
  return { kind: 'file', name, isSameEntry } as FileSystemFileHandle
}

describe('file identity', () => {
  test('matches equivalent handles without using file names as identity', async () => {
    const stored = makeHandle('design.fig', async (other) => other.name === 'alias.fig')
    const alias = makeHandle('alias.fig', async () => false)
    const sameName = makeHandle('design.fig', async () => false)

    await expect(
      fileIdentitiesMatch({ handle: stored, path: null }, { handle: alias, path: null })
    ).resolves.toBe(true)
    await expect(
      fileIdentitiesMatch({ handle: stored, path: null }, { handle: sameName, path: null })
    ).resolves.toBe(false)
  })

  test('ignores an asynchronous handle match after the tab source changes', async () => {
    const comparison = Promise.withResolvers<boolean>()
    const started = Promise.withResolvers<undefined>()
    const storedHandle = makeHandle('stored.fig', async () => {
      started.resolve(undefined)
      return comparison.promise
    })
    const incomingHandle = makeHandle('incoming.fig', async () => false)
    let storedIdentity: DocumentSourceIdentity = { handle: storedHandle, path: null }
    const tab = { store: { getSourceIdentity: () => storedIdentity } }

    const finding = findTabByFileIdentity([tab], {
      handle: incomingHandle,
      path: null
    })
    await started.promise
    storedIdentity = { handle: storedHandle, path: '/other.fig' }
    comparison.resolve(true)

    await expect(finding).resolves.toBeNull()
  })

  test('finds a tab by path and ignores tabs without stable identity', async () => {
    const matchedIdentity = { handle: null, path: '/tmp/design.fig' }
    const matched = {
      store: { getSourceIdentity: () => matchedIdentity }
    }
    const unidentifiedIdentity = { handle: null, path: null }
    const unidentified = {
      store: { getSourceIdentity: () => unidentifiedIdentity }
    }

    await expect(
      findTabByFileIdentity([unidentified, matched], {
        handle: null,
        path: '/tmp/design.fig'
      })
    ).resolves.toBe(matched)
    await expect(
      findTabByFileIdentity([unidentified], { handle: null, path: null })
    ).resolves.toBeNull()
  })
})

describe('openFileInNewTab deduplication', () => {
  beforeEach(() => {
    setupGlobals()
    vi.spyOn(layoutModule, 'computeAllLayouts').mockReturnValue(undefined)
    vi.spyOn(figModule, 'readFigFile').mockResolvedValue(new SceneGraph())
    createTab()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    toast.toasts.value = []
    Reflect.deleteProperty(globalThis, 'window')
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  })

  test('canonicalizes browser URLs before using them as file identity', () => {
    expect(resolveBrowserFileURL('/design.fig#selection').href).toBe('http://localhost/design.fig')
  })

  test('reuses the existing New tab when navigating to the files workspace', () => {
    const initialCount = tabCount()
    const initialHomeCount = getTabsSnapshot().filter((tab) => tab.kind === 'home').length

    showNewTab()
    showNewTab()

    expect(tabCount()).toBe(initialCount + (initialHomeCount === 0 ? 1 : 0))
    expect(getTabsSnapshot().filter((tab) => tab.kind === 'home')).toHaveLength(1)
  })

  test('keeps one Home pinned first, which never closes', async () => {
    createTab()
    const home = createHomeTab()
    expect(createHomeTab().id).toBe(home.id)
    expect(getTabsSnapshot()[0]?.id).toBe(home.id)
    await closeTab(home.id)
    expect(getTabsSnapshot().filter((tab) => tab.kind === 'home')).toEqual([home])
  })

  test('cycles through the tabs both ways, wrapping between the last tab and Home', () => {
    createTab()
    const home = createHomeTab()
    const tabs = getTabsSnapshot()
    const last = expectDefined(tabs.at(-1), 'last tab')
    const second = expectDefined(tabs[1], 'tab after Home')
    switchTab(last.id)

    switchAdjacentTab(1)
    expect(getActiveStore()).toBe(home.store)
    switchAdjacentTab(1)
    expect(getActiveStore()).toBe(second.store)
    switchAdjacentTab(-1)
    switchAdjacentTab(-1)
    expect(getActiveStore()).toBe(last.store)
  })

  test('pins Home first, moving it there or adding it when the tabs have none', () => {
    const design = createTab()
    const home = createHomeTab()
    const ids = (tabs: readonly Tab[]) => tabs.map((tab) => tab.id)
    expect(ids(withHomePinned([design], () => home))).toEqual([home.id, design.id])
    const pinned = [home, design]
    expect(withHomePinned(pinned, () => createTab())).toBe(pinned)
    expect(ids(withHomePinned([design, home], () => createTab()))).toEqual([home.id, design.id])
  })

  test('a failed recovery restore closes its tab and keeps the snapshot', async () => {
    resetRecoveryStoreForTests(createMemoryRecoveryStore())
    await getRecoveryStore().write({
      id: 'broken',
      sessionId: 'crashed-session',
      documentName: 'Broken',
      figBytes: new Uint8Array([1])
    })
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('read failed')
    )
    const home = createHomeTab()
    const count = tabCount()

    await expect(restoreRecoverySnapshot('broken')).rejects.toThrow('read failed')

    expect(tabCount()).toBe(count)
    expect(getActiveStore()).toBe(home.store)
    expect(await getRecoveryStore().read('broken')).not.toBeNull()
    resetRecoveryStoreForTests()
  })

  test('opens a file beside a restored Untitled copy, never over it', async () => {
    resetRecoveryStoreForTests(createMemoryRecoveryStore())
    await getRecoveryStore().write({
      id: 'draft',
      sessionId: 'left-to-sign-up',
      documentName: 'Untitled',
      figBytes: new Uint8Array([1])
    })
    await settleFileOpen(restoreRecoverySnapshot('draft'))
    const draft = getActiveStore()
    const count = tabCount()

    await settleFileOpen(
      openFileInNewTab(new File([], 'design.fig'), { path: '/tmp/after-draft.fig' })
    )

    expect(tabCount()).toBe(count + 1)
    expect(getActiveStore() === draft).toBe(false)
    expect(draft.getRecoveryId()).toBe('draft')
    resetRecoveryStoreForTests()
  })

  test('tells listeners when an untouched tab takes another document', async () => {
    const untouched = getActiveStore()
    const replaced: unknown[] = []
    const { off } = onTabDocumentReplaced((store) => replaced.push(store))
    await settleFileOpen(openFileInNewTab(new File([], 'design.fig'), { path: '/tmp/reused.fig' }))
    off()
    expect(getActiveStore() === untouched).toBe(true)
    expect(replaced.includes(untouched)).toBe(true)
  })

  test('opens a file from Home in a tab of its own, leaving Home as it is', async () => {
    const home = createHomeTab()
    const count = tabCount()

    await settleFileOpen(
      openFileInNewTab(new File([], 'design.fig'), { path: '/tmp/from-home.fig' })
    )

    expect(tabCount()).toBe(count + 1)
    expect(getTabsSnapshot().at(-1)?.kind).toBe('document')
    expect(
      expectDefined(
        getTabsSnapshot().find((tab) => tab.id === home.id),
        'home'
      ).kind
    ).toBe('home')
  })

  test('keeps a nonactive cover page lazy while opening the first page', async () => {
    const graph = new SceneGraph()
    graph.addPage('Cover')
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(graph)
    const populate = vi.spyOn(figModule, 'populateFigPage')

    await settleFileOpen(openFileInNewTab(new File([], 'cover.fig'), { path: '/tmp/cover.fig' }))

    expect(populate).not.toHaveBeenCalled()
  })

  test('closes the tab a file opened from Home got when it fails, leaving Home as it was', async () => {
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('read failed')
    )
    createTab()
    const home = createHomeTab()
    const count = tabCount()

    await expect(
      settleFileOpen(openFileInNewTab(new File([], 'broken.fig'), { path: '/tmp/broken.fig' }))
    ).rejects.toThrow('read failed')

    expect(tabCount()).toBe(count)
    const after = expectDefined(
      getTabsSnapshot().find((tab) => tab.id === home.id),
      'home tab'
    )
    expect([after.kind, after.store]).toEqual(['home', home.store])
    // Home was in front when the open began, so it is again, not the other design.
    expect(getActiveStore()).toBe(home.store)
  })

  test('keeps a document open in its tab when its first frame cannot be shown', async () => {
    createHomeTab()
    const count = tabCount()
    const failures: string[] = []
    const opening = openFileInNewTab(new File([], 'slow.fig'), { path: '/tmp/slow.fig' })

    // A canvas that stops drawing before the page is on screen, as a timed-out wait does.
    const stalled = new Set<Tab['store']>()
    await settleFileOpen(opening, (store) => {
      if (stalled.has(store)) return
      stalled.add(store)
      store.onPreparationEvent('preparation:failed', (failure) => failures.push(failure.code))
      store.preparationController.failCanvas(new Error('canvas stalled'))
    })
    const store = await opening

    expect(failures).toEqual(['render-failed'])
    expect(tabCount()).toBe(count + 1)
    expect(getActiveStore()).toBe(store)
    expect(store.state.documentName).toBe('slow')
  })

  test('keeps cross-page edits when following an agent takes over an opening tab', async () => {
    createHomeTab()
    const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)
    const agent = { session: 'opening-page-move', kind: 'mcp', client: 'codex' }
    const following = appPreferences.value.chat.followAgents
    const animations = appPreferences.value.appearance.animations
    appPreferences.value.chat.followAgents = true
    appPreferences.value.appearance.animations = 'off'

    const file = new File(
      [JSON.stringify({ children: [{ type: 'frame', id: 'card', width: 80, height: 60 }] })],
      'follow-during-open.pen'
    )
    const cancel = new AbortController()
    const firstFrameHeld = Promise.withResolvers<Tab['store']>()
    const opening = openFileInNewTab(file, {
      path: '/tmp/follow-during-open.pen',
      signal: cancel.signal
    })
    const opened = settleFileOpen(opening, (store) => {
      if (store.state.documentName === 'follow-during-open') firstFrameHeld.resolve(store)
    }).then(
      () => 'opened',
      (error: unknown) => (error instanceof Error ? error.name : String(error))
    )

    let stopWatching: (() => void) | undefined
    try {
      const store = await Promise.race([
        firstFrameHeld.promise,
        opened.then((status) => {
          throw new Error(`Open ended before the first frame was held: ${status}`)
        })
      ])
      const document = expectDefined(
        listAutomationDocuments(store).find((entry) => entry.name === 'follow-during-open'),
        'published document'
      )
      const card = expectDefined(store.graph.getChildren(document.current_page_id)[0], 'card')
      const target = { document_id: document.id }
      const followedPageShown = Promise.withResolvers<undefined>()
      stopWatching = store.onPreparationEvent('preparation:finished', (result) => {
        if (result.kind === 'page-switch' && result.status === 'completed') {
          followedPageShown.resolve(undefined)
        }
      })
      await handleRequest(store, 'tool', {
        ...target,
        name: 'create_page',
        args: { name: 'Next' }
      })
      const page = expectDefined(
        store.graph.getPages().find((entry) => entry.name === 'Next'),
        'page'
      )
      expect(
        await handleRequest(store, 'tool', {
          ...target,
          agent,
          name: 'reparent_node',
          args: { id: card.id, parent_id: page.id }
        })
      ).toMatchObject({ ok: true, result: { id: card.id, parent_id: page.id } })

      expect({
        status: await opened,
        listed: listAutomationDocuments(store).some((entry) => entry.id === document.id)
      }).toEqual({ status: 'opened', listed: true })
      expect(store.state.preparation?.kind).toBe('page-switch')
      await settleFileOpen(followedPageShown.promise)
      expect(store.state.currentPageId).toBe(page.id)
      expect(store.graph.getNode(card.id)?.parentId).toBe(page.id)
      expect(store.hasUnsavedChanges()).toBe(true)
    } finally {
      stopWatching?.()
      cancel.abort()
      appPreferences.value.chat.followAgents = following
      appPreferences.value.appearance.animations = animations
      await handleRequest(getActiveStore(), 'agent_session_closed', { session: agent.session })
    }
  })

  test('closes a newly opened tab when the user cancels its first frame wait', async () => {
    const home = createHomeTab()
    const count = tabCount()
    const controller = new AbortController()
    const opening = openFileInNewTab(new File([], 'cancelled.fig'), {
      path: '/tmp/cancelled.fig',
      signal: controller.signal
    })

    await expect(
      settleFileOpen(opening, (store) => {
        if (store.state.documentName === 'cancelled') controller.abort()
        else acknowledgePresentation(store)
      })
    ).rejects.toHaveProperty('name', 'AbortError')
    expect(tabCount()).toBe(count)
    expect(getActiveStore()).toBe(home.store)
  })

  test('activates the existing tab when the same path is opened again', async () => {
    const initialCount = tabCount()
    const file = new File([], 'design.fig')

    await settleFileOpen(openFileInNewTab(file, { path: '/tmp/design.fig' }))
    const openedStore = getActiveStore()
    await settleFileOpen(openFileInNewTab(file, { path: '/tmp/design.fig' }))

    expect(tabCount()).toBe(initialCount)
    expect(getActiveStore()).toBe(openedStore)
    expect(figModule.readFigFile).toHaveBeenCalledTimes(1)
  })

  test('shares one load between concurrent opens of the same path', async () => {
    const started = Promise.withResolvers<undefined>()
    const read = Promise.withResolvers<SceneGraph>()
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
      started.resolve(undefined)
      return read.promise
    })
    const initialCount = tabCount()
    const file = new File([], 'concurrent.fig')

    const first = openFileInNewTab(file, { path: '/tmp/concurrent.fig' })
    await started.promise
    const second = openFileInNewTab(file, { path: '/tmp/concurrent.fig' })
    await Promise.resolve()

    expect(figModule.readFigFile).toHaveBeenCalledTimes(1)
    read.resolve(new SceneGraph())
    await Promise.all([settleFileOpen(first), settleFileOpen(second)])
    expect(tabCount()).toBe(initialCount)
  })

  test('allows different files to load concurrently', async () => {
    const reads = [Promise.withResolvers<SceneGraph>(), Promise.withResolvers<SceneGraph>()]
    const bothStarted = Promise.withResolvers<undefined>()
    let readIndex = 0
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const read = reads[readIndex++]
      if (readIndex === 2) bothStarted.resolve(undefined)
      return read?.promise ?? Promise.resolve(new SceneGraph())
    })
    const initialCount = tabCount()

    const first = openFileInNewTab(new File([], 'first.fig'), { path: '/tmp/first.fig' })
    const second = openFileInNewTab(new File([], 'second.fig'), { path: '/tmp/second.fig' })
    await bothStarted.promise

    expect(figModule.readFigFile).toHaveBeenCalledTimes(2)
    reads[0].resolve(new SceneGraph())
    reads[1].resolve(new SceneGraph())
    await Promise.all([settleFileOpen(first), settleFileOpen(second)])
    expect(tabCount()).toBe(initialCount + 1)
  })

  test('removes a failed pending open so the file can be retried', async () => {
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce(new SceneGraph())

    await expect(
      settleFileOpen(openFileInNewTab(new File([], 'retry.fig'), { path: '/tmp/retry.fig' }))
    ).rejects.toThrow('read failed')
    await expect(
      settleFileOpen(openFileInNewTab(new File([], 'retry.fig'), { path: '/tmp/retry.fig' }))
    ).resolves.toBeUndefined()

    expect(figModule.readFigFile).toHaveBeenCalledTimes(2)
    expect(getActiveStore().getSourceIdentity().path).toBe('/tmp/retry.fig')
  })

  test('keeps same-named files distinct without a path or handle', async () => {
    const initialCount = tabCount()
    const file = new File([], 'same-name.fig')

    await settleFileOpen(openFileInNewTab(file))
    await settleFileOpen(openFileInNewTab(file))

    expect(tabCount()).toBe(initialCount + 1)
    expect(figModule.readFigFile).toHaveBeenCalledTimes(2)
  })
})
