import { useLocalStorage } from '@vueuse/core'

import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { getOutbox, type Outbox } from '@/app/storage/sync/outbox'

/**
 * Whether configured cloud storage actually receives uploads.
 *
 * Separate from having credentials on purpose. Clearing the key to stop
 * syncing means re-entering it to start again, and it destroys the one piece
 * of state that is genuinely inconvenient to recreate. This is a switch:
 * the destination stays configured, uploads stop.
 *
 * Off means PAUSE, not withdraw. Documents already in the bucket stay there,
 * the bucket keeps listing, and nothing is deleted. Turning it back on resumes
 * from where it left off.
 */
export const backupToCloud = useLocalStorage('open-pencil:storage:backup-enabled', true)

export type PauseDependencies = {
  store: LocalCanvasStore
  outbox: Outbox
}

/**
 * Stop pushing, immediately.
 *
 * Gating at enqueue is not enough on its own: work queued BEFORE the pause is
 * still durable, and the next thing that kicks the engine uploads it — so a
 * user who paused would watch documents go up anyway. Decision 7 is explicit
 * that pausing cancels queued outbound work.
 *
 * Queued only. A job already in flight is left to finish and can update just
 * the target it captured, so a completion landing after the pause cannot mark
 * the row synced for anywhere else. Cancelling it mid-request would leave the
 * remote in a state nothing recorded.
 *
 * Deletes are cancelled too, which is why the row keeps its tombstone: the
 * document stays gone locally, and the remote copy survives untouched until
 * backup resumes. Pausing must never reach the network.
 */
export async function pauseCloudBackup(dependencies?: PauseDependencies): Promise<string[]> {
  const outbox = dependencies?.outbox ?? getOutbox()
  const store = dependencies?.store ?? getLocalCanvasStore()

  const cancelled: string[] = []
  for (const job of await outbox.list()) {
    await outbox.remove(job.id)
    if (!cancelled.includes(job.canvasId)) cancelled.push(job.canvasId)
  }

  for (const canvasId of cancelled) {
    const meta = await store.getMeta(canvasId)
    // `pending` means a durable job exists. Nothing does now, so leaving it
    // would strand the row exactly the way the old rename path did.
    if (meta?.syncStatus === 'pending') {
      await store.updateMeta(canvasId, { syncStatus: 'local' })
    }
  }
  return cancelled
}

export function setBackupToCloud(enabled: boolean): void {
  backupToCloud.value = enabled
  if (!enabled) void pauseCloudBackup()
}

/** True when a save should reach the remote at all. */
export function backupIsActive(): boolean {
  return backupToCloud.value
}
