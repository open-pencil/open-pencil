import type { Router } from 'vue-router'

import { activeStorageProviderID } from '@/app/integrations/storage'
import type { StorageDocumentFormat } from '@/app/integrations/storage/types'
import { createCanvasId } from '@/app/storage/id'
import { createDeckTab, createTab } from '@/app/tabs'

/**
 * Make a document and open it.
 *
 * Shared by the workspace buttons and the Create menu in the tab strip so both
 * produce a real, named, persisted document. The strip's `+` used to call
 * `createTab()` directly, which made an unsaved blank that never appeared in
 * the workspace — the same phantom the editor stopped conjuring on mount.
 *
 * No cloud configured is not a refusal: the document is local-only, which is a
 * supported way to work.
 */
export async function createStorageDocument(
  sourceFormat: StorageDocumentFormat,
  router: Router
): Promise<void> {
  // Capture the provider the user was looking at, not whatever a route change
  // and a tick later happens to be live.
  const providerId = activeStorageProviderID.value

  // Create BEFORE routing. `/editor` refuses to mount without a document, so
  // arriving first would bounce straight off the view we are heading for.
  const store = sourceFormat === 'deck' ? (await createDeckTab()).store : createTab(undefined).store
  const documentId = createCanvasId()
  store.setStorageDocumentSource({ providerId, documentId }, 'Untitled', sourceFormat)

  await router.push('/editor')
  await store.saveFigFile()
}
