import type { StorageTargetID } from '@/app/storage/target'

export type OutboxJobType = 'putCanvas' | 'putMetadata' | 'putThumb' | 'deleteCanvas'

export type OutboxJob = {
  /**
   * Destination captured when the job was queued.
   *
   * `runJob` resolves THIS, never the current selection. Without it, changing
   * bucket or account between enqueue and drain silently redirected bytes to
   * wherever the UI happened to point. `null` means the job predates targets
   * and must be pinned or parked at migration, never guessed at drain time.
   */
  targetId: StorageTargetID | null
  id: string
  canvasId: string
  type: OutboxJobType
  /** Local revision for document/metadata puts; used to supersede older puts. */
  revision: number
  createdAt: number
  attempts: number
  nextAttemptAt: number
}

/**
 * `error` is a transient failure still being retried. `blocked` is terminal:
 * every queued job is parked and nothing will move until the user repairs
 * configuration. They are distinct because a blocked queue used to fall through
 * and render as "Syncing…" indefinitely.
 */
export type SyncUiState = 'idle' | 'syncing' | 'offline' | 'error' | 'blocked'

/**
 * Pure helper: drop superseded putCanvas jobs for the same canvas.
 *
 * `>=` rather than `>` would keep a job at the SAME revision, so two enqueues
 * at one revision both survived and uploaded identical bytes twice. The engine
 * always uploads the row's current body regardless of which job triggered it,
 * so any queued putCanvas for a canvas is fully redundant with a newer one —
 * an equal revision included.
 */
export function supersedePutCanvasJobs(
  jobs: OutboxJob[],
  canvasId: string,
  revision: number,
  targetId: StorageTargetID | null
): OutboxJob[] {
  return jobs.filter((job) => {
    if (job.canvasId !== canvasId || job.type !== 'putCanvas') return true
    // Partitioned by destination. Without this, queueing an upload for target B
    // silently discarded one already owed to target A — the two are different
    // work and both are owed. Cancelling A's job is retargeting's decision to
    // make explicitly, not a side effect of saving to somewhere else.
    if (job.targetId !== targetId) return true
    return job.revision > revision
  })
}

export function makeJobId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
