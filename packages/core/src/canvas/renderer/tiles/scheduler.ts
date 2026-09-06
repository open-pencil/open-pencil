import { rendererNow } from '#core/canvas/renderer/clock'

import type { TileKey } from './geometry'

export type TileJobPriority = 'mandatory' | 'visible' | 'overscan'

export interface TileJob {
  key: TileKey
  navigationGeneration: number
  contentGeneration: number
  priority: TileJobPriority
  fallbackAvailable: boolean
  estimatedCost: number
}

export interface TileJobResult {
  renderMs: number
  overBudget: boolean
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

  runFrame(execute: (job: TileJob) => TileJobResult): TileSchedulerMetrics {
    const frameStart = this.now()
    const metrics = emptyTileSchedulerMetrics()

    let jobsExecuted = 0
    while (this.jobs.length > 0) {
      if (jobsExecuted >= this.maximumJobsPerFrame) break
      const job = this.jobs[0]
      const elapsed = this.now() - frameStart
      const mandatory = job.priority === 'mandatory' && !job.fallbackAvailable
      if (jobsExecuted > 0 && elapsed >= this.budgetMs) break
      if (this.isStale(job)) {
        this.jobs.shift()
        metrics.staleJobsDiscarded++
        continue
      }
      if (!mandatory && job.fallbackAvailable && elapsed + job.estimatedCost > this.budgetMs) {
        if (jobsExecuted === 0) {
          const result = execute(job)
          this.jobs.shift()
          metrics.interruptibleCompleted++
          addJobMetrics(metrics, result)
          if (result.overBudget || result.renderMs > this.budgetMs) metrics.overBudgetJobs++
          const overrun = this.now() - frameStart - this.budgetMs
          if (overrun > metrics.deadlineOverrunMs) metrics.deadlineOverrunMs = overrun
        } else {
          metrics.skippedWithFallback++
        }
        break
      }
      this.jobs.shift()
      const result = execute(job)
      jobsExecuted++
      addJobMetrics(metrics, result)
      if (result.overBudget || result.renderMs > this.budgetMs) metrics.overBudgetJobs++
      if (mandatory) metrics.mandatoryCompleted++
      else metrics.interruptibleCompleted++
      const overrun = this.now() - frameStart - this.budgetMs
      if (overrun > metrics.deadlineOverrunMs) metrics.deadlineOverrunMs = overrun
    }
    metrics.remaining = this.jobs.length
    return metrics
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
