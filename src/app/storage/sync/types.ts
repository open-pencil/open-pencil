export type OutboxJobType = 'putCanvas' | 'putMetadata' | 'putThumb' | 'deleteCanvas'

export type OutboxJob = {
  id: string
  canvasId: string
  type: OutboxJobType
  /** Local revision for document and metadata puts; used to supersede older puts. */
  revision: number
  createdAt: number
  attempts: number
  nextAttemptAt: number
}

/** `conflict` is not a fault: two devices edited one design and it is being kept as both. */
export type SyncUIState = 'idle' | 'syncing' | 'offline' | 'error' | 'conflict'

/**
 * Drop putCanvas jobs for the same canvas that a new one supersedes. An equal revision is
 * superseded too: the engine always uploads the row's current body, so two jobs at one revision
 * would send identical bytes twice.
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
