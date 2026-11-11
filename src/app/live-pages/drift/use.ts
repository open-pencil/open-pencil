import { computed, ref, shallowRef } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/session'

import { useLivePages, type LivePageEntry } from '../use'
import { desktopPageCapture } from './capture'
import type { DriftState } from './compare'
import {
  comparePages,
  setBaseline,
  type BaselineTarget,
  type CompareOutcome,
  type PageCapture
} from './run'
import type { DriftFile, DriftReference } from './schema'
import { readDocumentDrift, writeDocumentDrift } from './store'

/**
 * Where one document's baselines are kept. Narrowed to a read and a write, so a comparison can
 * run without a whole editor behind it.
 */
export type DriftDocument = {
  read(): DriftFile
  write(file: DriftFile): void
}

/** The baselines of the open document, kept on its root layer. */
export function documentBaselines(store: EditorStore): DriftDocument {
  return {
    read() {
      // Reading the scene version subscribes the caller to every edit, undo, and peer change:
      // a baseline is plugin data on a node, and the graph itself is not reactive.
      void store.state.sceneVersion
      return readDocumentDrift(store)
    },
    write(file) {
      writeDocumentDrift(store, file)
    }
  }
}

/** Why nothing happened, which the panel says in its own words. */
export type DriftFailure = 'not-drawn' | 'not-saved'

export type PageDriftOptions = {
  /** The pages on the canvas; the live pages of the open document by default. */
  pages?: LivePageEntry[]
  /** Where the baselines live; the open document by default. */
  document?: DriftDocument
  /** How a page is drawn; the desktop's own browser by default. */
  capture?: PageCapture
}

/**
 * The baselines of the open document: which page has one, how each page stood at the last
 * comparison, and the two actions that keep a baseline and compare against it. A page is compared
 * by the fingerprint of its picture, so nothing large is stored in the document.
 */
export function usePageDrift(options: PageDriftOptions = {}) {
  const pages = options.pages ? computed(() => options.pages ?? []) : useLivePages().pages
  const document = options.document ?? documentBaselines(useEditorStore())
  const capture = options.capture ?? desktopPageCapture()

  /** How many baselines were written here, which a document store reports through its graph. */
  const revision = ref(0)
  const busy = ref(false)
  const failure = shallowRef<DriftFailure | null>(null)
  /** How each page stood at the last comparison of this session, by frame. */
  const outcomes = shallowRef<Record<string, DriftState>>({})

  const file = computed<DriftFile>(() => {
    // A written baseline is an edit; the store's own graph version covers an undo or a peer's
    // change, and `revision` covers the writes that just happened here.
    void revision.value
    return document.read()
  })

  const references = computed<Record<string, DriftReference>>(() => file.value.references)
  const count = computed(() => pages.value.length)

  /** The baseline kept for one page, or null while the page has none. */
  function baselineOf(nodeId: string): DriftReference | null {
    return references.value[nodeId] ?? null
  }

  /** How one page stood at the last comparison, or null until this session compared it. */
  function stateOf(nodeId: string): DriftState | null {
    return outcomes.value[nodeId] ?? null
  }

  /** The frames a call covers: one frame when it is named, every page on the canvas otherwise. */
  function targets(nodeId?: string): BaselineTarget[] {
    return pages.value
      .filter((entry) => nodeId === undefined || entry.nodeId === nodeId)
      .map((entry) => ({
        nodeId: entry.nodeId,
        url: entry.page.url,
        width: Math.round(entry.node.width),
        height: Math.round(entry.node.height)
      }))
  }

  /**
   * Run one action alone, reporting the reason nothing happened rather than throwing. Keeping a
   * baseline can fail on the document; a comparison only fails on a page that would not draw.
   */
  async function run<T>(
    work: () => Promise<T>,
    reason: DriftFailure = 'not-saved'
  ): Promise<T | null> {
    if (busy.value) return null
    busy.value = true
    failure.value = null
    try {
      return await work()
    } catch (error) {
      if (reason === 'not-drawn') console.warn('[Drift] The pages could not be compared:', error)
      else console.warn('[Drift] The baselines could not be updated:', error)
      failure.value = reason
      return null
    } finally {
      busy.value = false
    }
  }

  /**
   * Keep the current picture of one page, or of every page on the canvas, as its baseline. A page
   * that could not be drawn keeps the baseline it already had, and the set is written only when
   * something was actually kept.
   */
  async function keep(nodeId?: string): Promise<number> {
    const wanted = targets(nodeId)
    if (wanted.length === 0) return 0
    const kept = await run(async () => {
      let next = document.read()
      const states: Record<string, DriftState> = { ...outcomes.value }
      let count = 0
      for (const target of wanted) {
        const written = await setBaseline(next, target, capture)
        // The same file comes back when the page could not be drawn, and nothing is written.
        if (written === next) continue
        next = written
        states[target.nodeId] = 'same'
        count += 1
      }
      if (count > 0) {
        document.write(next)
        revision.value += 1
        outcomes.value = states
      }
      return count
    })
    if (kept === null) return 0
    if (kept === 0) failure.value = 'not-drawn'
    return kept
  }

  /**
   * How each page stands to the baseline kept for it: `same` while its picture has not changed,
   * `changed` once it has, and `none` for a page with no baseline or no picture to compare.
   */
  async function compare(nodeId?: string): Promise<CompareOutcome[]> {
    const wanted = targets(nodeId)
    if (wanted.length === 0) return []
    const compared = await run(() => comparePages(document.read(), wanted, capture), 'not-drawn')
    if (compared === null) return []
    const states: Record<string, DriftState> = { ...outcomes.value }
    for (const outcome of compared) states[outcome.nodeId] = outcome.state
    outcomes.value = states
    // A page with no baseline is simply not compared yet; one that has a baseline it could not be
    // drawn against is a picture that never arrived.
    const undrawn = compared.some(
      (outcome) => outcome.state === 'none' && baselineOf(outcome.nodeId) !== null
    )
    if (undrawn) failure.value = 'not-drawn'
    return compared
  }

  return {
    pages,
    count,
    busy,
    failure,
    baselineOf,
    stateOf,
    keep,
    compare
  }
}

export type PageDrift = ReturnType<typeof usePageDrift>
