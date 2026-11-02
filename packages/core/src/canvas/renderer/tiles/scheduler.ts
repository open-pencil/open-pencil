import { rendererNow } from '#core/canvas/renderer/clock'

import type { TileKey } from './geometry'

export type TileJobPriority = 'mandatory' | 'visible' | 'overscan'

export type TileJobKind = 'render' | 'downsample'

export interface TileJob {
  key: TileKey
  /** Rendered from the scene, or downsampled from the four cached tiles twice as fine. */
  kind?: TileJobKind
  navigationGeneration: number
  contentGeneration: number
  priority: TileJobPriority
  fallbackAvailable: boolean
  estimatedCost: number
}

export interface TileJobResult {
  renderMs: number
  overBudget: boolean
  /** The job made progress but is not done; it stays first in the queue for the next frame. */
  deferred?: boolean
  allocationMs?: number
  drawMs?: number
  flushMs?: number
  snapshotMs?: number
  chunkCount?: number
}

export interface TileSchedulerMetrics {
  mandatoryCompleted: number
  interruptibleCompleted: number
  remaining: number
  skippedWithFallback: number
  deadlineOverrunMs: number
  overBudgetJobs: number
  maximumJobRenderMs: number
  staleJobsDiscarded: number
  cancelledJobs: number
  /** Frames ended on a job that recorded part of its work and will continue next frame. */
  deferredJobs: number
  totalAllocationMs: number
  totalDrawMs: number
  totalFlushMs: number
  totalSnapshotMs: number
  totalChunks: number
}

export interface TileSchedulerOptions {
  now?: () => number
  budgetMs: number
  maximumJobsPerFrame?: number
}

export function emptyTileSchedulerMetrics(): TileSchedulerMetrics {
  return {
    mandatoryCompleted: 0,
    interruptibleCompleted: 0,
    remaining: 0,
    skippedWithFallback: 0,
    deadlineOverrunMs: 0,
    overBudgetJobs: 0,
    maximumJobRenderMs: 0,
    staleJobsDiscarded: 0,
    cancelledJobs: 0,
    deferredJobs: 0,
    totalAllocationMs: 0,
    totalDrawMs: 0,
    totalFlushMs: 0,
    totalSnapshotMs: 0,
    totalChunks: 0
  }
}

function addJobMetrics(metrics: TileSchedulerMetrics, result: TileJobResult): void {
  metrics.maximumJobRenderMs = Math.max(metrics.maximumJobRenderMs, result.renderMs)
  metrics.totalAllocationMs += result.allocationMs ?? 0
  metrics.totalDrawMs += result.drawMs ?? 0
  metrics.totalFlushMs += result.flushMs ?? 0
  metrics.totalSnapshotMs += result.snapshotMs ?? 0
  metrics.totalChunks += result.chunkCount ?? 0
}

const PRIORITY_ORDER: Record<TileJobPriority, number> = {
  mandatory: 0,
  visible: 1,
  overscan: 2
}

export class TileScheduler {
  private navigationGeneration = 0
  private contentGeneration = 0
  private jobs: TileJob[] = []
  private readonly now: () => number
  private readonly budgetMs: number
  private readonly maximumJobsPerFrame: number

  constructor(options: TileSchedulerOptions) {
    this.now = options.now ?? rendererNow
    this.budgetMs = options.budgetMs
    this.maximumJobsPerFrame = options.maximumJobsPerFrame ?? Number.POSITIVE_INFINITY
  }

  setGeneration(navigationGeneration: number, contentGeneration: number): number {
    const previousCount = this.jobs.length
    this.navigationGeneration = navigationGeneration
    this.contentGeneration = contentGeneration
    this.jobs = this.jobs.filter(
      (job) =>
        job.navigationGeneration === navigationGeneration &&
        job.contentGeneration === contentGeneration
    )
    return previousCount - this.jobs.length
  }

  enqueue(jobs: TileJob[]): void {
    const existing = new Set(this.jobs.map((job) => this.identity(job)))
    for (const job of jobs) {
      if (
        job.navigationGeneration !== this.navigationGeneration ||
        job.contentGeneration !== this.contentGeneration ||
        existing.has(this.identity(job))
      ) {
        continue
      }
      this.jobs.push(job)
      existing.add(this.identity(job))
    }
    this.jobs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }

  /** Drops queued jobs matching `predicate` and returns how many it dropped. */
  discard(predicate: (job: TileJob) => boolean): number {
    const previousCount = this.jobs.length
    this.jobs = this.jobs.filter((job) => !predicate(job))
    return previousCount - this.jobs.length
  }

  /**
   * Runs queued jobs until `budgetMs` is spent. A job estimated to overrun it is skipped when a
   * fallback exists, except that the frame's first job may overrun up to `firstJobLimitMs`: an
   * idle renderer sets no limit so it always makes progress, and a moving one sets a small one
   * so an affordable tile still fills in while the expensive ones ahead of it wait for idle.
   */
  runFrame(
    execute: (job: TileJob, remainingMs: number) => TileJobResult,
    budgetMs: number = this.budgetMs,
    firstJobLimitMs = Number.POSITIVE_INFINITY
  ): TileSchedulerMetrics {
    const frameStart = this.now()
    const metrics = emptyTileSchedulerMetrics()

    let jobsExecuted = 0
    const deferred: TileJob[] = []
    while (this.jobs.length > 0) {
      if (jobsExecuted >= this.maximumJobsPerFrame) break
      const job = this.jobs[0]
      const elapsed = this.now() - frameStart
      const mandatory = job.priority === 'mandatory' && !job.fallbackAvailable
      if (jobsExecuted > 0 && elapsed >= budgetMs) break
      if (this.isStale(job)) {
        this.jobs.shift()
        metrics.staleJobsDiscarded++
        continue
      }
      if (!mandatory && job.fallbackAvailable && elapsed + job.estimatedCost > budgetMs) {
        if (jobsExecuted > 0) {
          metrics.skippedWithFallback++
          break
        }
        if (elapsed + job.estimatedCost <= firstJobLimitMs) {
          this.runJob(job, execute, metrics, frameStart, budgetMs, mandatory)
          break
        }
        // Too dear for this frame: leave it queued and look for an affordable one behind it.
        this.jobs.shift()
        deferred.push(job)
        metrics.skippedWithFallback++
        continue
      }
      if (!this.runJob(job, execute, metrics, frameStart, budgetMs, mandatory)) break
      jobsExecuted++
    }
    if (deferred.length > 0) {
      this.jobs.unshift(...deferred)
      this.jobs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    }
    metrics.remaining = this.jobs.length
    return metrics
  }

  /** Runs the first job; false when it deferred, which ends the frame with it still first. */
  private runJob(
    job: TileJob,
    execute: (job: TileJob, remainingMs: number) => TileJobResult,
    metrics: TileSchedulerMetrics,
    frameStart: number,
    budgetMs: number,
    mandatory: boolean
  ): boolean {
    this.jobs.shift()
    const result = execute(job, Math.max(0, budgetMs - (this.now() - frameStart)))
    addJobMetrics(metrics, result)
    const overrun = this.now() - frameStart - budgetMs
    if (overrun > metrics.deadlineOverrunMs) metrics.deadlineOverrunMs = overrun
    if (result.deferred) {
      this.jobs.unshift(job)
      metrics.deferredJobs++
      return false
    }
    if (result.overBudget || result.renderMs > budgetMs) metrics.overBudgetJobs++
    if (mandatory) metrics.mandatoryCompleted++
    else metrics.interruptibleCompleted++
    return true
  }

  clear(): number {
    const count = this.jobs.length
    this.jobs = []
    return count
  }

  pending(): number {
    return this.jobs.length
  }

  private identity(job: TileJob): string {
    const { key } = job
    return `${key.pageId}:${key.level}:${key.x}:${key.y}:${job.contentGeneration}`
  }

  private isStale(job: TileJob): boolean {
    return (
      job.navigationGeneration !== this.navigationGeneration ||
      job.contentGeneration !== this.contentGeneration
    )
  }
}
