export type OutboxJobType = 'putCanvas' | 'putMetadata' | 'putThumb' | 'deleteCanvas'

export type OutboxJob = {
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
  revision: number
): OutboxJob[] {
  return jobs.filter((job) => {
    if (job.canvasId !== canvasId || job.type !== 'putCanvas') return true
    return job.revision > revision
  })
}

export function makeJobId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
