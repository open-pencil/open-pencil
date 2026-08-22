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
}

export interface TileSchedulerOptions {
  now?: () => number
  budgetMs: number
  maximumJobsPerFrame?: number
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
    this.now = options.now ?? (() => performance.now())
    this.budgetMs = options.budgetMs
    this.maximumJobsPerFrame = options.maximumJobsPerFrame ?? Number.POSITIVE_INFINITY
  }

  setGeneration(navigationGeneration: number, contentGeneration: number): void {
    this.navigationGeneration = navigationGeneration
    this.contentGeneration = contentGeneration
    this.jobs = this.jobs.filter(
      (job) =>
        job.navigationGeneration === navigationGeneration &&
        job.contentGeneration === contentGeneration
    )
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
    const metrics: TileSchedulerMetrics = {
      mandatoryCompleted: 0,
      interruptibleCompleted: 0,
      remaining: 0,
      skippedWithFallback: 0,
      deadlineOverrunMs: 0,
      overBudgetJobs: 0,
      maximumJobRenderMs: 0,
      staleJobsDiscarded: 0
    }

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
          jobsExecuted++
          metrics.interruptibleCompleted++
          metrics.maximumJobRenderMs = Math.max(metrics.maximumJobRenderMs, result.renderMs)
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
      metrics.maximumJobRenderMs = Math.max(metrics.maximumJobRenderMs, result.renderMs)
      if (result.overBudget || result.renderMs > this.budgetMs) metrics.overBudgetJobs++
      if (mandatory) metrics.mandatoryCompleted++
      else metrics.interruptibleCompleted++
      const overrun = this.now() - frameStart - this.budgetMs
      if (overrun > metrics.deadlineOverrunMs) metrics.deadlineOverrunMs = overrun
    }
    metrics.remaining = this.jobs.length
    return metrics
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
