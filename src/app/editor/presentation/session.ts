import { documentKindRules } from '@open-pencil/core/editor'

import type { EditorStore } from '@/app/editor/active-store'

function slidePages(store: EditorStore) {
  return store.getPages()
}

function currentSlideIndex(store: EditorStore): number {
  return slidePages(store).findIndex((page) => page.id === store.state.currentPageId)
}

/**
 * Enter presentation on the current slide.
 *
 * Sets `presenting` on the store; fullscreen is requested by
 * `usePresentationSession` so the command path and the Present control share
 * one state transition. No-op for non-presentable documents.
 */
export function enterPresentation(store: EditorStore): void {
  if (!documentKindRules(store.state.documentKind).presentable) return
  if (store.state.presenting) return

  if (store.state.editingTextId) store.commitTextEdit()
  store.clearSelection()
  store.state.hoveredNodeId = null
  store.state.presenting = true
  store.zoomToFit()
}

/**
 * Leave presentation and restore the editing camera for the current slide.
 * Fullscreen release is handled by `usePresentationSession` watching `presenting`.
 */
export function exitPresentation(store: EditorStore): void {
  if (!presentationActive(store)) return

  store.state.presenting = false
  store.zoomToFit()
}

/**
 * Slide navigation applies in either mode.
 *
 * `presenting` means this window shows the slideshow; `presenterMode` means it drives a
 * second window that does. Guarding on `presenting` alone left every control in the
 * presenter bar dead, since the presenter's own window is not the one presenting.
 */
function presentationActive(store: EditorStore): boolean {
  return store.state.presenting || store.state.presenterMode
}

async function goToSlide(store: EditorStore, index: number): Promise<void> {
  const pages = slidePages(store)
  if (pages.length === 0) return
  const clamped = Math.max(0, Math.min(index, pages.length - 1))
  const page = pages[clamped]
  if (page.id === store.state.currentPageId) return
  await store.switchPage(page.id)
  store.zoomToFit()
}

/** Advance one slide; stays on the last slide without wrapping or exiting. */
export async function presentNext(store: EditorStore): Promise<void> {
  if (!presentationActive(store)) return
  const index = currentSlideIndex(store)
  if (index < 0) return
  await goToSlide(store, index + 1)
}

/** Go back one slide; stays on the first slide without wrapping. */
export async function presentPrevious(store: EditorStore): Promise<void> {
  if (!presentationActive(store)) return
  const index = currentSlideIndex(store)
  if (index < 0) return
  await goToSlide(store, index - 1)
}

/** Jump to the first slide. */
export async function presentFirst(store: EditorStore): Promise<void> {
  if (!presentationActive(store)) return
  await goToSlide(store, 0)
}

/** Jump to the last slide. */
export async function presentLast(store: EditorStore): Promise<void> {
  if (!presentationActive(store)) return
  const pages = slidePages(store)
  await goToSlide(store, pages.length - 1)
}

export function presentationSlidePosition(store: EditorStore): {
  current: number
  total: number
} {
  const pages = slidePages(store)
  const index = currentSlideIndex(store)
  return {
    current: index >= 0 ? index + 1 : 1,
    total: Math.max(1, pages.length)
  }
}
