import { afterEach, describe, expect, jest, test } from 'bun:test'

import { nextTick, toRaw, watch } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session'
import { appPreferences, parseAppPreferences } from '@/app/settings/preferences/store'

const stores: ReturnType<typeof createEditorStore>[] = []
let previousPreferences: typeof appPreferences.value | undefined
afterEach(() => {
  for (const store of stores.splice(0)) store.dispose()
  if (previousPreferences) appPreferences.value = previousPreferences
  previousPreferences = undefined
  jest.useRealTimers()
})

/** Canvas markers follow the preference, which a fresh profile now leaves off. */
function setMarkersOnCanvas(showOnCanvas: boolean) {
  previousPreferences ??= structuredClone(toRaw(appPreferences.value))
  const preferences = structuredClone(toRaw(appPreferences.value))
  preferences.designCheck.showOnCanvas = showOnCanvas
  appPreferences.value = preferences
}

/** Two pages, each with text small enough for the design check to mark on the canvas. */
function twoPagesWithIssues() {
  setMarkersOnCanvas(true)
  const graph = new SceneGraph()
  const first = graph.getPages()[0]
  const second = graph.addPage('Second')
  const [firstText, secondText] = [first, second].map((page) =>
    graph.createNode('TEXT', page.id, { name: 'Caption', text: 'Caption', fontSize: 8 })
  )
  const store = createEditorStore(graph)
  stores.push(store)
  const checkedPages: string[] = []
  watch(
    store.designCheck.snapshot,
    (snapshot) => {
      if (snapshot) checkedPages.push(snapshot.pageId)
    },
    { flush: 'sync' }
  )
  const markedNodes = () => (store.state.designIssues?.markers ?? []).map((m) => m.nodeId)
  return { store, first, second, firstText, secondText, checkedPages, markedNodes }
}

/** The editor's own switch; the app's adds a progress overlay with timers of its own. */
async function switchPage(store: ReturnType<typeof createEditorStore>, pageId: string) {
  const prepared = await store.preparePage(pageId)
  if (prepared) store.commitPageSwitch(prepared)
  await nextTick()
}

/** Lets the check scheduled after a change run. */
async function settleCheck() {
  jest.advanceTimersByTime(1000)
  await nextTick()
}

describe('canvas markers', () => {
  test('stay off when nothing is stored, and appear once turned on', async () => {
    jest.useFakeTimers()
    // This harness has no localStorage, so an empty profile is the value nothing stored parses to.
    previousPreferences ??= structuredClone(toRaw(appPreferences.value))
    appPreferences.value = parseAppPreferences(null)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'Caption',
      text: 'Caption',
      fontSize: 8
    })
    const store = createEditorStore(graph)
    stores.push(store)
    await nextTick()

    expect(store.designCheck.enabled.value).toBe(false)
    expect(store.designCheck.snapshot.value).toBeNull()
    expect(store.state.designIssues?.markers ?? []).toEqual([])

    setMarkersOnCanvas(true)
    await nextTick()

    expect((store.state.designIssues?.markers ?? []).map((marker) => marker.nodeId)).toEqual([
      text.id
    ])
  })
})

describe('the design check across a page switch', () => {
  test('checks the new page once, after the switch', async () => {
    jest.useFakeTimers()
    const { store, first, second, firstText, secondText, checkedPages, markedNodes } =
      twoPagesWithIssues()
    expect(store.designCheck.snapshot.value?.pageId).toBe(first.id)
    expect(markedNodes()).toEqual([firstText.id])

    await switchPage(store, second.id)
    // The previous page's markers would point at layers that are no longer shown.
    expect(markedNodes()).toEqual([])
    expect(checkedPages).toEqual([])

    await settleCheck()
    expect(checkedPages).toEqual([second.id])
    expect(markedNodes()).toEqual([secondText.id])
  })

  test('opening an issue on another page checks that page right away', async () => {
    jest.useFakeTimers()
    const { store, second, secondText, checkedPages } = twoPagesWithIssues()
    const issue = {
      id: `min-text-size:${secondText.id}:0`,
      ruleId: 'min-text-size',
      nodeId: secondText.id,
      pageId: second.id,
      severity: 'warning' as const,
      message: '',
      nodeName: 'Caption',
      nodePath: ['Caption']
    }

    await store.designCheck.openIssue(issue)

    // The Lint panel focuses the issue's row, which needs the new page's issues already.
    expect(checkedPages).toEqual([second.id])
    expect(store.designCheck.snapshot.value?.issues.map(({ id }) => id)).toContain(issue.id)
    expect(store.designCheck.focusedIssueId.value).toBe(issue.id)
  })
})

describe('a page visited before', () => {
  test('shows its last result at once when nothing on it changed', async () => {
    jest.useFakeTimers()
    const { store, first, second, secondText, markedNodes } = twoPagesWithIssues()
    await switchPage(store, second.id)
    await settleCheck()
    await switchPage(store, first.id)
    await settleCheck()

    await switchPage(store, second.id)

    // Before the check that follows the switch runs.
    expect(markedNodes()).toEqual([secondText.id])
  })

  test('shows the first page checked at once too', async () => {
    jest.useFakeTimers()
    const { store, first, second, firstText, markedNodes } = twoPagesWithIssues()
    await switchPage(store, second.id)
    // The second page's check replaces the first's result; the background checks wait longer.
    jest.advanceTimersByTime(300)
    await nextTick()

    await switchPage(store, first.id)

    expect(markedNodes()).toEqual([firstText.id])
  })

  test('waits for a new check when it changed while away', async () => {
    jest.useFakeTimers()
    const { store, first, second, secondText, markedNodes } = twoPagesWithIssues()
    await switchPage(store, second.id)
    await settleCheck()
    await switchPage(store, first.id)
    await settleCheck()
    store.updateNode(secondText.id, { fontSize: 16 })

    await switchPage(store, second.id)
    expect(markedNodes()).toEqual([])

    await settleCheck()
    expect(markedNodes()).toEqual([])
  })
})

describe('the focused issue', () => {
  test('is dropped as soon as its layer is deleted', () => {
    const { store, firstText } = twoPagesWithIssues()
    store.designCheck.openMarker([firstText.id])
    expect(store.designCheck.focusedIssueId.value).not.toBeNull()

    // Until the next check, the panel still lists the deleted layer's issue and would reveal it.
    store.deleteSelected()

    expect(store.designCheck.focusedIssueId.value).toBeNull()
  })

  test('is dropped once the check no longer finds it', async () => {
    jest.useFakeTimers()
    const { store, firstText } = twoPagesWithIssues()
    store.designCheck.openMarker([firstText.id])

    store.updateNode(firstText.id, { fontSize: 16 })
    await nextTick()
    jest.advanceTimersByTime(1000)
    await nextTick()

    expect(store.designCheck.focusedIssueId.value).toBeNull()
  })
})
