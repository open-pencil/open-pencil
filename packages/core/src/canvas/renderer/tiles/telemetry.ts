import { emitNavigationTrace } from '#core/profiler'

import type { TileSchedulerMetrics } from './scheduler'

export interface TileFrameTrace {
  contentGeneration: number
  metrics: TileSchedulerMetrics
  tileCacheBytes: number
  tileCacheEntries: number
  visibleTileCount: number
  presentedTileCount: number
  fallbackTileCount: number
  uncoveredAreaCount: number
  uncoveredContentAreaCount: number
  covered: boolean
}

export function emitTileFrameTrace(frame: TileFrameTrace): void {
  const { metrics } = frame
  emitNavigationTrace('render:end', {
    layer: 'tiled-scheduler',
    sceneVersion: frame.contentGeneration,
    mandatoryCompleted: metrics.mandatoryCompleted,
    interruptibleCompleted: metrics.interruptibleCompleted,
    remaining: metrics.remaining,
    skippedWithFallback: metrics.skippedWithFallback,
    deadlineOverrunMs: metrics.deadlineOverrunMs,
    overBudgetJobs: metrics.overBudgetJobs,
    maximumJobRenderMs: metrics.maximumJobRenderMs,
    staleJobsDiscarded: metrics.staleJobsDiscarded,
    cancelledJobs: metrics.cancelledJobs,
    deferredJobs: metrics.deferredJobs,
    tileAllocationMs: metrics.totalAllocationMs,
    tileDrawMs: metrics.totalDrawMs,
    tileFlushMs: metrics.totalFlushMs,
    tileSnapshotMs: metrics.totalSnapshotMs,
    tileChunks: metrics.totalChunks,
    tileCacheBytes: frame.tileCacheBytes,
    tileCacheEntries: frame.tileCacheEntries,
    visibleTileCount: frame.visibleTileCount,
    presentedTileCount: frame.presentedTileCount,
    fallbackTileCount: frame.fallbackTileCount,
    uncoveredAreaCount: frame.uncoveredAreaCount,
    uncoveredContentAreaCount: frame.uncoveredContentAreaCount,
    covered: frame.covered
  })
}

export function emitTileCoverageComplete(
  level: number,
  contentGeneration: number,
  navigationGeneration: number,
  tileCacheEntries: number,
  tileCacheBytes: number
): void {
  emitNavigationTrace('tiles:coverage-complete', {
    level,
    sceneVersion: contentGeneration,
    navigationGeneration,
    tileCacheEntries,
    tileCacheBytes
  })
}
