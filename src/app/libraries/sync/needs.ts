import { watch } from 'vue'

import { readSourceLibraryPublication } from '@open-pencil/core/library'

import type { EditorStore } from '@/app/editor/session'
import { libraryResolutionKey } from '@/app/libraries/sync/status'
import { documentTabStores } from '@/app/tabs/state'

/** One `latest`/`revisions/<id>` pair a document has stated intent on. */
export interface RevisionNeed {
  libraryId: string
  revisionId: string
  key: string
}

export interface NeedsFlags {
  includeInstanceRevs: boolean
  includePublication: boolean
}

/**
 * The revisions open documents want: enabled bindings, latests that moved past them, and on
 * request the instances' and the publication baseline's revisions. `mirrorLatest` maps
 * `libraryId → latestRevisionId` as the mirror knows it.
 */
export function computeNeeds(
  stores: readonly EditorStore[],
  mirrorLatest: ReadonlyMap<string, string>,
  flags: NeedsFlags
): Map<string, RevisionNeed> {
  const needs = new Map<string, RevisionNeed>()
  const add = (libraryId: string, revisionId: string) => {
    if (!libraryId || !revisionId) return
    const key = libraryResolutionKey(libraryId, revisionId)
    needs.set(key, { libraryId, revisionId, key })
  }
  for (const store of stores) {
    const graph = store.graph
    for (const binding of graph.enabledLibraries.values()) {
      if (!binding.enabled) continue
      add(binding.libraryId, binding.revisionId)
      const latest = mirrorLatest.get(binding.libraryId)
      if (latest && latest !== binding.revisionId) add(binding.libraryId, latest)
    }
    if (flags.includeInstanceRevs) {
      for (const node of graph.getAllNodes()) {
        const identity = node.librarySource?.identity
        if (!identity) continue
        add(identity.libraryId, identity.revisionId)
        // Update review diffs instance revisions against the library's latest even when the
        // binding is off, so a disabled library's latest revision counts as a need too.
        const latest = mirrorLatest.get(identity.libraryId)
        if (latest && latest !== identity.revisionId) add(identity.libraryId, latest)
      }
    }
    if (flags.includePublication) {
      const publication = readSourceLibraryPublication(graph)
      if (publication) add(publication.libraryId, publication.revisionId)
    }
  }
  return needs
}

const needsProviderRefs = new Set<WeakRef<EditorStore>>()
let subscribedStores = new WeakSet<EditorStore>()

/** An editor whose bindings count toward needs — service registrations and open tabs. */
export function registerNeedsProvider(store: EditorStore): void {
  if (subscribedStores.has(store)) return
  subscribedStores.add(store)
  needsProviderRefs.add(new WeakRef(store))
  // Every registered store counts, active or not: a background tab's bindings can
  // change under collaboration and still need their revisions.
  store.onEditorEvent('document:libraries-changed', () => {
    onNeedsChange?.()
  })
}

let onNeedsChange: (() => void) | null = null

/**
 * Registers every open document tab and calls `kick` whenever the tab set changes, which
 * signals new needs without changing the remote.
 */
export function watchNeedsProviders(kick: () => void): () => void {
  onNeedsChange = kick
  const stop = watch(
    documentTabStores,
    (stores) => {
      for (const store of stores) registerNeedsProvider(store)
      kick()
    },
    { immediate: true }
  )
  return () => {
    onNeedsChange = null
    stop()
  }
}

export function currentNeedsProviders(): EditorStore[] {
  for (const store of documentTabStores.value) registerNeedsProvider(store)
  const stores: EditorStore[] = []
  for (const ref of needsProviderRefs) {
    const store = ref.deref()
    if (store) stores.push(store)
  }
  return stores
}

/** Test seam: drops the registered providers between runs. */
export function resetNeedsProvidersForTests(): void {
  needsProviderRefs.clear()
  subscribedStores = new WeakSet()
  onNeedsChange = null
}
