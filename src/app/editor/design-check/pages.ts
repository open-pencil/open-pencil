import { useTimeoutFn } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { countIssues, type DesignIssue, type DesignIssueCounts } from './issues'

/** Pause after an edit before other pages are checked in the background. */
const BACKGROUND_DELAY_MS = 800
/** Pause between two background page checks, which keeps input responsive. */
const BACKGROUND_STEP_MS = 32

export interface PageChecksOptions {
  graph: () => SceneGraph
  currentPageId: () => string
  /** Pages a large `.fig` file has not loaded yet; checking them would load them. */
  isPending: (pageId: string) => boolean
  /** Whether an interactive edit is under way, which background checks wait out. */
  isBusy: () => boolean
  check: (pageId: string) => DesignIssue[]
  /** Pauses before checking after an edit, and between pages; tests pass zero. */
  delays?: { idle: number; step: number }
}

/** The page holding a layer, or the page itself. */
export function pageOf(graph: SceneGraph, nodeId: string | null | undefined): string | null {
  return nodeId ? (graph.closest(nodeId, (node) => node.type === 'CANVAS')?.id ?? null) : null
}

/**
 * Keeps every loaded page checked, one page at a time while the editor is idle, so the page list
 * and the Document scope can show issues beyond the current page. The current page is checked
 * live by the session, which reports its results here. Pages not loaded yet are left out.
 */
export function createPageChecks(options: PageChecksOptions) {
  const results = shallowRef<ReadonlyMap<string, readonly DesignIssue[]>>(new Map())
  const stale = new Set<string>()
  const active = ref(false)
  const { idle = BACKGROUND_DELAY_MS, step: stepDelay = BACKGROUND_STEP_MS } = options.delays ?? {}
  const delay = ref(idle)
  const timer = useTimeoutFn(step, delay, { immediate: false })

  function schedule(wait: number) {
    if (!active.value) return
    delay.value = wait
    timer.start()
  }

  function store(pageId: string, issues: readonly DesignIssue[] | null) {
    const next = new Map(results.value)
    if (issues) next.set(pageId, issues)
    else next.delete(pageId)
    results.value = next
  }

  function nextPage(): string | null {
    const graph = options.graph()
    const current = options.currentPageId()
    for (const pageId of stale) {
      if (!graph.getNode(pageId)) {
        stale.delete(pageId)
        store(pageId, null)
        continue
      }
      if (pageId !== current && !options.isPending(pageId)) return pageId
    }
    return null
  }

  function step() {
    if (!active.value) return
    if (options.isBusy()) {
      schedule(idle)
      return
    }
    const pageId = nextPage()
    if (!pageId) return
    stale.delete(pageId)
    store(pageId, options.check(pageId))
    if (nextPage()) schedule(stepDelay)
  }

  /** The live result for the current page. */
  function report(pageId: string, issues: readonly DesignIssue[]) {
    stale.delete(pageId)
    store(pageId, issues)
  }

  /** A page changed: its result is out of date until it is checked again. */
  function invalidate(pageId: string | null) {
    if (!pageId) return
    stale.add(pageId)
    schedule(idle)
  }

  /** Rules or the document changed: every page is checked again. */
  function invalidateAll() {
    results.value = new Map()
    stale.clear()
    for (const page of options.graph().getPages()) stale.add(page.id)
    schedule(idle)
  }

  function start() {
    if (active.value) return
    active.value = true
    invalidateAll()
  }

  function stop() {
    active.value = false
    timer.stop()
    stale.clear()
    results.value = new Map()
  }

  /** Errors and warnings per checked page; suggestions stay in the Lint panel. */
  const counts = computed(() => {
    const byPage = new Map<string, DesignIssueCounts>()
    for (const [pageId, issues] of results.value) byPage.set(pageId, countIssues(issues))
    return byPage
  })

  const unchecked = computed(() =>
    options
      .graph()
      .getPages()
      .filter((page) => !results.value.has(page.id))
  )
  /** Loaded pages waiting for their check. */
  const queued = computed(() =>
    unchecked.value.filter((page) => !options.isPending(page.id)).map((page) => page.id)
  )
  /** Pages a large file has not loaded yet; they are checked once opened. */
  const notLoaded = computed(() =>
    unchecked.value.filter((page) => options.isPending(page.id)).map((page) => page.id)
  )

  return {
    results,
    counts,
    queued,
    notLoaded,
    active,
    report,
    invalidate,
    invalidateAll,
    start,
    stop
  }
}

export type PageChecks = ReturnType<typeof createPageChecks>
