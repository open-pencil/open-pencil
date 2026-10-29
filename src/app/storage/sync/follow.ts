import { effectScope, onScopeDispose, watch } from 'vue'

import { getLocalCanvasStore } from '@/app/storage/local-store'
import { getOutbox } from '@/app/storage/sync/outbox'
import { uploadProgressByCanvas } from '@/app/storage/sync/progress'
import { syncUIState } from '@/app/storage/sync/status'
import { isParkedJob } from '@/app/storage/sync/types'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'

/** How following an upload ended: on its storage, stopped for the person, or no longer followed. */
export type UploadOutcome = 'uploaded' | 'failed' | 'stopped'

/** Whether the document is on its storage, waits for the person, or is still on its way. */
async function uploadState(documentId: string): Promise<'uploaded' | 'failed' | null> {
  const meta = await getLocalCanvasStore().getMeta(documentId)
  if (meta?.syncStatus === 'synced') return 'uploaded'
  if (meta?.syncStatus === 'error') return 'failed'
  // The engine parks a job it cannot finish until the person acts, rather than dropping it.
  const jobs = await getOutbox().list()
  return jobs.some((job) => job.canvasId === documentId && isParkedJob(job)) ? 'failed' : null
}

/**
 * Follows a document's upload until it is on its storage or stops for something the person must
 * do, reporting the share sent so far. Aborting `signal` stops following; the upload goes on.
 */
export function followUpload(
  documentId: string,
  options: { onProgress?: (sent: number) => void; signal?: AbortSignal } = {}
): Promise<UploadOutcome> {
  const { onProgress, signal } = options
  if (signal?.aborted) return Promise.resolve('stopped')
  return new Promise((resolve) => {
    const scope = effectScope(true)
    let finished = false
    const finish = (outcome: UploadOutcome) => {
      if (finished) return
      finished = true
      scope.stop()
      resolve(outcome)
    }
    async function check() {
      const state = await uploadState(documentId)
      if (state) finish(state)
    }
    scope.run(() => {
      watch(uploadProgressByCanvas, (progress) => {
        const sent = progress.get(documentId)
        if (sent !== undefined) onProgress?.(sent)
      })
      // Failures move the engine's state without a document event.
      watch(syncUIState, () => void check())
      onScopeDispose(
        onStorageWorkspaceEvent((event) => {
          if (event.documentId === documentId) void check()
        })
      )
      const stop = () => finish('stopped')
      signal?.addEventListener('abort', stop)
      onScopeDispose(() => signal?.removeEventListener('abort', stop))
    })
    // A small file can finish uploading before anything here is watching.
    void check()
  })
}
