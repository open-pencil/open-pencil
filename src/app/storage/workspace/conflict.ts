import { filesMessages } from '@open-pencil/vue'

import { createActiveStorageAdapter } from '@/app/integrations/storage'
import {
  resolveStorageConflict,
  type ConflictOutcome,
  type ConflictResolution
} from '@/app/storage/conflict'
import { currentStorageDestination } from '@/app/storage/destination'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { getOutbox } from '@/app/storage/sync/outbox'
import { enqueuePutCanvas, enqueuePutMetadata } from '@/app/storage/sync/runtime'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { closeTab, getTabsSnapshot } from '@/app/tabs'

const resolving = new Set<string>()

function openTabsOf(id: string) {
  return getTabsSnapshot().filter((tab) => tab.store.getStorageBinding()?.documentId === id)
}

/**
 * Resolve a design in conflict. Automatic resolution keeps both versions; the card menu offers
 * the explicit choice when an automatic attempt could not complete (the remote was unreachable).
 */
export async function resolveLibraryConflict(
  id: string,
  resolution: ConflictResolution
): Promise<ConflictOutcome> {
  if (resolving.has(id)) return { copyId: null }
  resolving.add(id)
  try {
    const store = getLocalCanvasStore()
    const row = await store.getMeta(id)
    if (!row) return { copyId: null }
    // Dropping this device's version also drops what an open editor shows of it.
    if (resolution === 'use-remote') {
      for (const tab of openTabsOf(id)) await closeTab(tab.id)
    }
    const outcome = await resolveStorageConflict(id, resolution, {
      store,
      outbox: getOutbox(),
      adapter: createActiveStorageAdapter(row.providerId),
      destination: currentStorageDestination(row.providerId),
      enqueueCanvas: enqueuePutCanvas,
      enqueueMetadata: enqueuePutMetadata,
      copyName: (name) => filesMessages.get().conflictedCopy({ name }),
      rebindOpenDesign: (fromId, toId, name) => {
        for (const tab of openTabsOf(fromId)) tab.store.rebindLibraryDocument(toId, name)
      }
    })
    emitStorageWorkspaceEvent({ providerId: row.providerId, documentId: id, kind: 'changed' })
    return outcome
  } finally {
    resolving.delete(id)
  }
}

/** Two devices changed one design: keep both, without asking. A failure leaves it in conflict. */
export async function resolveConflictAutomatically(id: string): Promise<void> {
  try {
    await resolveLibraryConflict(id, 'keep-both')
  } catch (error) {
    console.warn('[Library] Could not resolve the conflict automatically:', id, error)
  }
}
