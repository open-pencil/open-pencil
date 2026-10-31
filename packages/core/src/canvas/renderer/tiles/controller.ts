import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  nodeRequiresAtomicChunk,
  RenderChunkIndex,
  RenderChunkPictureCache
} from '#core/canvas/renderer/chunks'
import { rendererNow } from '#core/canvas/renderer/clock'

import {
  type CachedTile,
  TileImageCache,
  viewportTileBytes,
  viewportTileCacheBudget
} from './cache'
import {
  MAX_TILE_LEVEL,
  MIN_TILE_LEVEL,
  TILE_DEVICE_SIZE,
  type TileKey,
  tileLevel,
  type TileWorldBounds
} from './geometry'
import { planTiles, type TilePlanOptions } from './planner'
import { drawPresentation, resolveVisible } from './presentation'
import { childTileKeys, deleteRenderedTile, downsampleTile, renderTile, tileChunks } from './render'
import {
  emptyTileSchedulerMetrics,
  TileScheduler,
  type TileJob,
  type TileSchedulerMetrics
} from './scheduler'
import { TileSurfacePool } from './surface-pool'
import { emitTileCoverageComplete, emitTileFrameTrace } from './telemetry'

const TILE_FRAME_BUDGET_MS = 8
/** Tile work per frame while the viewport moves, leaving the rest to input and presentation. */
const NAVIGATION_TILE_BUDGET_MS = 2
/** The one tile a moving frame may still afford past its budget; dearer tiles wait for idle. */
const NAVIGATION_FIRST_TILE_LIMIT_MS = 4
const MAXIMUM_TILE_JOBS_PER_FRAME = 128
const TILE_OVERSCAN = 1
/** The backdrop is this many times coarser than the visible level, and reaches this far out. */
const BACKDROP_LEVEL_RATIO = 4
const BACKDROP_OVERSCAN = 1
/** How many halvings of the visible level the pyramid keeps: 2⁶ covers a 64× zoom out. */
const PYRAMID_LEVELS = 6
/** The whole page is kept at a level where its longer side spans this many tiles. */
const PAGE_BACKDROP_TILES = 4
const TILE_COST_SMOOTHING = 0.3
/** Exact levels are keyed to this many bits of the scale's logarithm: stable across float noise. */
const EXACT_LEVEL_BITS = 20

/**
 * The level a settled view renders at: the device scale itself, so tiles draw on whole device
 * pixels without resampling, rounded so a gesture that ends a few ulps from where it began
 * finds its tiles again instead of rendering them anew. Quantized levels serve the backdrop.
 */
function exactTileLevel(scale: number): number {
  const clamped = Math.min(MAX_TILE_LEVEL, Math.max(MIN_TILE_LEVEL, scale))
  return 2 ** (Math.round(Math.log2(clamped) * 2 ** EXACT_LEVEL_BITS) / 2 ** EXACT_LEVEL_BITS)
}

function smoothCost(previous: number | undefined, costMs: number): number {
  if (previous === undefined) return costMs
  return previous * (1 - TILE_COST_SMOOTHING) + costMs * TILE_COST_SMOOTHING
}

export interface TiledSceneFrameResult {
  /** Every visible tile exists at the current level. */
  covered: boolean
  /** Visible tiles are still outstanding: settlement waits for this. */
  pending: boolean
  /**
   * Work beyond the visible tiles remains, the overscan ring, the page copy, the pyramid, or
   * the backdrop ring, which only proceeds in frames, so the caller should keep scheduling them.
   */
  backgroundPending: boolean
  metrics: TileSchedulerMetrics
  /** Tiles of other levels drawn, scaled, where the current level has none yet. */
  fallbackTileCount: number
  /** Visible tile areas no level covers; they show the page colour until their tiles render. */
  uncoveredAreaCount: number
  /** Those of the uncovered areas that lie over the page's content rather than empty canvas. */
  uncoveredContentAreaCount: number
}

export interface TiledSceneControllerOptions {
  /** The clock the scheduler's deadline and the tile cost model share. */
  now?: () => number
  /** The tile cache's byte budget for a viewport whose tiles weigh `viewportBytes`. */
  tileCacheBudget?: (viewportBytes: number) => number
}

export class TiledSceneController {
  private readonly now: () => number
  private index: RenderChunkIndex | null = null
  private pageId: string | null = null
  private contentGeneration = -1
  private navigationGeneration = -1
  private navigationActive = false
  private cancelledJobs = 0
  private pendingInvalidations: Array<{
    nodeId: string
    previousBounds: TileWorldBounds[]
  }> = []
  private lastCoveredGeneration = ''
  private lastLevel: number | null = null
  /**
   * Set when a frame of background work evicted a tile its own plan needs: the cache cannot hold
   * the plan, so the stages stop rather than render each other out until the view changes.
   */
  private backgroundSaturated = false
  private readonly tileCacheBudget: (viewportBytes: number) => number
  private readonly pictureCache = new RenderChunkPictureCache()
  private readonly tileCache = new TileImageCache()
  private readonly surfacePool = new TileSurfacePool()
  private readonly scheduler: TileScheduler
  /** Smoothed render time of each tile already rendered, in ms. */
  private readonly measuredCosts = new Map<string, number>()
  /**
   * Smoothed render time of any tile, in ms: the estimate for a tile not rendered yet. The
   * scheduler compares estimates with its frame budget, so they must be times, not node counts.
   */
  private typicalCostMs: number | undefined

  constructor(options: TiledSceneControllerOptions = {}) {
    this.now = options.now ?? rendererNow
    this.tileCacheBudget = options.tileCacheBudget ?? viewportTileCacheBudget
    this.scheduler = new TileScheduler({
      now: this.now,
      budgetMs: TILE_FRAME_BUDGET_MS,
      maximumJobsPerFrame: MAXIMUM_TILE_JOBS_PER_FRAME
    })
  }

  invalidateNode(nodeId: string, graph?: SceneGraph): void {
    const chunks = this.index?.getChunksDependingOnNode(nodeId) ?? []
    const owningChunks = this.index?.getChunksForNode(nodeId) ?? []
    const node = graph?.getNode(nodeId)
    if (
      graph &&
      node &&
      owningChunks.some((chunk) => chunk.interruptible === nodeRequiresAtomicChunk(graph, node))
    ) {
      this.invalidateStructure()
      return
    }
    this.pendingInvalidations.push({
      nodeId,
      previousBounds: chunks.map(({ minX, minY, maxX, maxY }) => ({ minX, minY, maxX, maxY }))
    })
  }

  invalidateStructure(): void {
    this.invalidate()
  }

  /**
   * Whether invalidations recorded since the last frame still await it. Unlike the renderer's
   * settlement flags, this is current between frames; queued background jobs do not count, as
   * settlement means the visible tiles.
   */
  hasPendingWork(): boolean {
    return this.pendingInvalidations.length > 0
  }

  /** The tile cache's current byte budget. */
  tileCacheBytes(): number {
    return this.tileCache.budget()
  }

  /**
   * Renders due tiles within the frame's budget and presents the viewport from the cache: exact
   * tiles where they exist, the nearest level's tiles scaled where they do not, and the page
   * colour where no level has one, until its tile renders. Nothing is drawn straight from the
   * scene, whose whole-page picture a large document cannot afford. Navigation keeps presenting,
   * renders under a shorter budget while panning or paused, and renders nothing while the zoom
   * level moves; the retained backing plays no part. Idle time builds a pyramid of downsampled copies and a
   * scene-rendered backdrop around the viewport, so a zoom out finds scaled stand-ins.
   */
  renderFrame(
    renderer: SkiaRenderer,
    canvas: Canvas,
    graph: SceneGraph,
    contentGeneration: number,
    navigationGeneration: number
  ): TiledSceneFrameResult {
    this.navigationGeneration = navigationGeneration
    this.navigationActive = this.isNavigationActive(renderer)
    this.prepareGeneration(renderer, graph, contentGeneration, navigationGeneration)
    const viewport = {
      minX: -renderer.panX / renderer.zoom,
      minY: -renderer.panY / renderer.zoom,
      maxX: (-renderer.panX + renderer.viewportWidth) / renderer.zoom,
      maxY: (-renderer.panY + renderer.viewportHeight) / renderer.zoom
    }
    const index = this.index
    if (!index || !renderer.pageId) return this.emptyResult()

    // A zoom in motion changes level every frame, and a tile rendered mid-gesture is obsolete
    // within a few frames, so while the level moves nothing renders and the pyramid, the page
    // copy, and the earlier levels stand in, scaled; a zoom that pauses, and a pan, render at
    // the exact level under the moving budget.
    const level = exactTileLevel(renderer.zoom * renderer.dpr)
    const zooming = renderer.navigationPhase === 'zoom' && level !== this.lastLevel
    if (level !== this.lastLevel || this.navigationActive) this.backgroundSaturated = false
    this.lastLevel = level
    this.tileCache.setBudget(
      this.tileCacheBudget(
        viewportTileBytes(
          renderer.viewportWidth * renderer.dpr,
          renderer.viewportHeight * renderer.dpr
        )
      )
    )
    const { planOptions, background } = this.planFrame(
      renderer,
      renderer.pageId,
      index,
      level,
      viewport,
      contentGeneration,
      navigationGeneration
    )
    const plan = planTiles(this.tileCache, planOptions)
    let metrics: TileSchedulerMetrics
    if (zooming) {
      metrics = emptyTileSchedulerMetrics()
      metrics.remaining = plan.jobs.length
      metrics.skippedWithFallback = plan.jobs.filter((job) => job.fallbackAvailable).length
    } else {
      this.scheduler.enqueue(plan.jobs)
      metrics = this.scheduler.runFrame(
        (job, remainingMs) => this.executeJob(renderer, graph, index, job, remainingMs),
        this.navigationActive ? NAVIGATION_TILE_BUDGET_MS : TILE_FRAME_BUDGET_MS,
        this.firstJobLimit()
      )
    }
    metrics.cancelledJobs += this.cancelledJobs
    this.cancelledJobs = 0
    // A background tile that evicted one of the plan's own levels would render in circles.
    if (background && this.backgroundSaturated) {
      this.cancelledJobs += this.scheduler.discard((job) => job.priority === 'overscan')
      planOptions.overscanTiles = 0
      delete planOptions.backdrop
      delete planOptions.pageBackdrop
      delete planOptions.pyramid
    }
    // A stage is planned only once the previous one is done, so the plan is taken again after
    // the frame's work to learn whether anything remains for the next frame, and to queue it.
    // While moving, only the visible tiles are planned, and the frame does not re-plan.
    const next = this.navigationActive ? plan : planTiles(this.tileCache, planOptions)
    if (!this.navigationActive) this.scheduler.enqueue(next.jobs)

    const visible = planTiles(
      this.tileCache,
      {
        pageId: renderer.pageId,
        level,
        viewport,
        overscanTiles: 0,
        navigationGeneration,
        contentGeneration,
        estimateCost: () => 0
      },
      true
    ).visible
    const presentation = resolveVisible(
      this.tileCache,
      visible,
      renderer.pageId,
      level,
      index.bounds()
    )
    canvas.save()
    // Snapped to device pixels, an exact tile lands texel on pixel and copies rather than samples.
    canvas.translate(
      Math.round(renderer.panX * renderer.dpr) / renderer.dpr,
      Math.round(renderer.panY * renderer.dpr) / renderer.dpr
    )
    canvas.scale(renderer.zoom, renderer.zoom)
    drawPresentation(renderer, canvas, presentation)
    canvas.restore()

    const covered = presentation.exact.length === visible.length
    emitTileFrameTrace({
      contentGeneration,
      metrics,
      tileCacheBytes: this.tileCache.byteSize(),
      tileCacheEntries: this.tileCache.size(),
      visibleTileCount: visible.length,
      presentedTileCount: presentation.exact.length,
      fallbackTileCount: presentation.fallback.length,
      uncoveredAreaCount: presentation.uncovered,
      uncoveredContentAreaCount: presentation.uncoveredContent,
      covered
    })
    const settledGenerationKey = `${navigationGeneration}:${contentGeneration}`
    if (covered && !this.navigationActive && this.lastCoveredGeneration !== settledGenerationKey) {
      this.lastCoveredGeneration = settledGenerationKey
      emitTileCoverageComplete(
        level,
        contentGeneration,
        navigationGeneration,
        this.tileCache.size(),
        this.tileCache.byteSize()
      )
    }
    const visiblePending = next.visible.some(
      ({ tile }) => tile?.contentGeneration !== contentGeneration
    )
    return {
      covered,
      pending: visiblePending || !covered,
      backgroundPending: !this.navigationActive && this.scheduler.pending() > 0,
      metrics,
      fallbackTileCount: presentation.fallback.length,
      uncoveredAreaCount: presentation.uncovered,
      uncoveredContentAreaCount: presentation.uncoveredContent
    }
  }

  invalidate(): void {
    this.cancelledJobs += this.scheduler.clear()
    this.index?.dispose()
    this.index = null
    this.pageId = null
    this.contentGeneration = -1
    this.lastCoveredGeneration = ''
    this.lastLevel = null
    this.pendingInvalidations = []
    this.measuredCosts.clear()
    this.pictureCache.clear()
    this.tileCache.clear()
  }

  destroy(): void {
    this.invalidate()
    this.cancelledJobs = 0
    this.navigationGeneration = -1
    this.navigationActive = false
    this.typicalCostMs = undefined
    this.surfacePool.clear()
  }

  private isNavigationActive(renderer: SkiaRenderer): boolean {
    return (
      renderer.navigationPhase === 'pan' ||
      renderer.navigationPhase === 'zoom' ||
      renderer.navigationPhase === 'momentum' ||
      renderer.navigationPhase === 'settling'
    )
  }

  private prepareGeneration(
    renderer: SkiaRenderer,
    graph: SceneGraph,
    contentGeneration: number,
    navigationGeneration: number
  ): void {
    this.cancelledJobs += this.scheduler.setGeneration(navigationGeneration, contentGeneration)
    // Node changes arrive through invalidateNode() and structural ones through
    // invalidateStructure(), so a new content generation on its own is a redraw request (every
    // requestRender() bumps it) and the rendered tiles stay valid. Invalidations also arrive
    // without a new generation, as when an image preview decodes.
    if (
      this.index &&
      this.pageId === renderer.pageId &&
      (this.contentGeneration !== contentGeneration || this.pendingInvalidations.length > 0)
    ) {
      this.applyPendingInvalidations(graph, contentGeneration)
    }
    if (this.index && this.pageId !== renderer.pageId) this.invalidate()
    // Without an index nothing can be shown, so a page that arrives mid-gesture builds its index
    // at once; its tiles then fill in under the moving budget rather than after the gesture.
    if (this.index === null && renderer.pageId) {
      this.ensureIndex(graph, renderer.pageId, contentGeneration)
    }
  }

  private applyPendingInvalidations(graph: SceneGraph, contentGeneration: number): void {
    const index = this.index
    if (!index || !this.pageId) return
    this.tileCache.advanceGeneration(contentGeneration)
    for (const invalidation of this.pendingInvalidations) {
      const before = invalidation.previousBounds
      const chunks = index.getChunksDependingOnNode(invalidation.nodeId)
      for (const chunk of chunks) this.pictureCache.invalidate(chunk.id)
      for (const chunk of chunks) index.updateNode(graph, chunk.nodeId)
      const after = index.getChunksDependingOnNode(invalidation.nodeId)
      for (const bounds of [...before, ...after]) {
        this.tileCache.invalidateBounds(this.pageId, bounds, contentGeneration)
      }
    }
    this.pendingInvalidations = []
    this.contentGeneration = contentGeneration
  }

  private ensureIndex(graph: SceneGraph, pageId: string | null, contentGeneration: number): void {
    if (this.index && this.pageId === pageId && this.contentGeneration === contentGeneration) return
    this.index?.dispose()
    this.pictureCache.clear()
    this.tileCache.markStale(contentGeneration)
    this.pageId = pageId
    this.contentGeneration = contentGeneration
    // A fresh index already reflects every change recorded before it was built.
    this.pendingInvalidations = []
    this.index = pageId ? RenderChunkIndex.build(graph, pageId).index : null
  }

  /**
   * How far past its budget a frame's first job may run: a moving frame keeps its fallback
   * rather than a dear tile, an idle one always makes progress, or a tile dearer than any limit
   * would never render and its stage never end.
   */
  private firstJobLimit(): number {
    return this.navigationActive ? NAVIGATION_FIRST_TILE_LIMIT_MS : Number.POSITIVE_INFINITY
  }

  /**
   * A tile over nothing is free; while moving, a tile with a chunk picture still to record is
   * beyond the frame, since recording cannot be bounded below one chunk; otherwise the tile's
   * own smoothed cost, or that of any tile until it has been measured.
   */
  private estimateCost(
    renderer: SkiaRenderer,
    index: RenderChunkIndex,
    key: TileKey,
    moving: boolean
  ): number {
    const chunks = tileChunks(index, key)
    if (chunks.length === 0) return 0
    if (
      moving &&
      chunks.some(
        (chunk) =>
          (chunk.kind !== 'subtree' || chunk.interruptible) &&
          !this.pictureCache.has(renderer, chunk)
      )
    ) {
      return Number.POSITIVE_INFINITY
    }
    return this.measuredCosts.get(this.costKey(key)) ?? this.typicalCostMs ?? 0
  }

  /**
   * Recording a chunk's picture is the dear part of a tile, so a tile whose chunks are not all
   * recorded yet records them until the frame's budget is spent and defers the rest; the tile
   * itself renders, from recorded pictures, on the frame that finds them all present.
   */
  private recordChunkPictures(
    renderer: SkiaRenderer,
    graph: SceneGraph,
    index: RenderChunkIndex,
    key: TileKey,
    remainingMs: number
  ): boolean {
    const deadline = this.now() + remainingMs
    let recorded = 0
    for (const chunk of tileChunks(index, key)) {
      if (chunk.kind === 'subtree' && !chunk.interruptible) continue
      if (this.pictureCache.has(renderer, chunk)) continue
      if (recorded > 0 && this.now() >= deadline) return false
      this.pictureCache.get(renderer, graph, chunk)
      recorded++
    }
    return true
  }

  /**
   * The frame's plan options: the visible tiles and, while idle and the cache can hold them, the
   * background stages; queued jobs for other levels are discarded, and the cache counts the
   * evictions of the levels the plan needs.
   */
  private planFrame(
    renderer: SkiaRenderer,
    pageId: string,
    index: RenderChunkIndex,
    level: number,
    viewport: TileWorldBounds,
    contentGeneration: number,
    navigationGeneration: number
  ): { planOptions: TilePlanOptions; background: boolean } {
    // Jobs planned at another level draw nothing the viewport shows now; a downsample is cheap
    // and feeds the fallback at any level, so it stays.
    const backdropLevel = tileLevel((level / BACKDROP_LEVEL_RATIO) * (1 - 1e-9))
    const pageBackdrop = this.pageBackdrop(index, level)
    this.cancelledJobs += this.scheduler.discard(
      (job) =>
        job.kind !== 'downsample' &&
        job.key.level !== level &&
        job.key.level !== backdropLevel &&
        job.key.level !== pageBackdrop?.level
    )
    const planOptions: TilePlanOptions = {
      pageId,
      level,
      viewport,
      overscanTiles: this.backgroundSaturated ? 0 : TILE_OVERSCAN,
      navigationGeneration,
      contentGeneration,
      estimateCost: (key) => this.estimateCost(renderer, index, key, this.navigationActive),
      globalFallbackAvailable: true
    }
    // Background stages wait for idle: a moving frame has only its budget to give.
    const background = !this.navigationActive && !this.backgroundSaturated
    if (background) {
      planOptions.backdrop = { level: backdropLevel, overscanTiles: BACKDROP_OVERSCAN }
      planOptions.pageBackdrop = pageBackdrop
      planOptions.pyramid = { levels: PYRAMID_LEVELS }
    }
    const watched = new Set([level, backdropLevel])
    if (pageBackdrop) watched.add(pageBackdrop.level)
    for (let depth = 1; depth <= PYRAMID_LEVELS; depth++) watched.add(level / 2 ** depth)
    this.tileCache.watchLevels(watched)
    return { planOptions, background }
  }

  private executeJob(
    renderer: SkiaRenderer,
    graph: SceneGraph,
    index: RenderChunkIndex,
    job: TileJob,
    remainingMs: number
  ) {
    const startedAt = this.now()
    if (
      job.kind !== 'downsample' &&
      !this.recordChunkPictures(renderer, graph, index, job.key, remainingMs)
    ) {
      return { renderMs: this.now() - startedAt, overBudget: false, deferred: true }
    }
    const tile =
      job.kind === 'downsample'
        ? this.downsample(renderer, job)
        : renderTile(renderer, graph, index, job.key, this.pictureCache, this.surfacePool)
    if (!tile) return { renderMs: 0, overBudget: job.kind !== 'downsample' }
    if (job.kind !== 'downsample') this.recordCost(job.key, this.now() - startedAt)
    if (
      job.navigationGeneration !== this.navigationGeneration ||
      job.contentGeneration !== this.contentGeneration
    ) {
      deleteRenderedTile(tile)
      return this.jobResult(tile)
    }
    this.tileCache.takeWatchedEvictions()
    this.tileCache.install(tile, job.contentGeneration)
    if (job.priority === 'overscan' && this.tileCache.takeWatchedEvictions() > 0) {
      this.backgroundSaturated = true
    }
    return this.jobResult(tile)
  }

  /** Null when a child has gone since the job was planned; the next plan decides again. */
  private downsample(renderer: SkiaRenderer, job: TileJob) {
    const children: CachedTile[] = []
    for (const childKey of childTileKeys(job.key)) {
      const child = this.tileCache.getIfPresent(childKey)
      if (!child || child.contentGeneration !== job.contentGeneration) return null
      children.push(child)
    }
    return downsampleTile(renderer, job.key, children, this.surfacePool)
  }

  /**
   * The whole page at a level coarse enough to fit PAGE_BACKDROP_TILES along its longer side,
   * or undefined when the visible level is already that coarse. The level depends only on the
   * page, so its tiles stay valid across zooms.
   */
  private pageBackdrop(
    index: RenderChunkIndex,
    level: number
  ): { level: number; bounds: TileWorldBounds } | undefined {
    const bounds = index.bounds()
    if (!bounds) return undefined
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    const pageLevel = Math.max(
      MIN_TILE_LEVEL,
      tileLevel((PAGE_BACKDROP_TILES * TILE_DEVICE_SIZE) / span)
    )
    if (pageLevel >= level) return undefined
    return { level: pageLevel, bounds }
  }

  /** Whether the cache holds a fresh tile for `key`. */
  isRendered(key: TileKey): boolean {
    return this.tileCache.getIfPresent(key)?.contentGeneration === this.contentGeneration
  }

  private jobResult(tile: NonNullable<ReturnType<typeof renderTile>>) {
    return {
      renderMs: tile.renderMs,
      overBudget: tile.renderMs > TILE_FRAME_BUDGET_MS,
      allocationMs: tile.allocationMs,
      drawMs: tile.drawMs,
      flushMs: tile.flushMs,
      snapshotMs: tile.snapshotMs,
      chunkCount: tile.chunkCount
    }
  }

  private recordCost(key: TileKey, costMs: number): void {
    const id = this.costKey(key)
    this.measuredCosts.set(id, smoothCost(this.measuredCosts.get(id), costMs))
    this.typicalCostMs = smoothCost(this.typicalCostMs, costMs)
  }

  private costKey(key: TileKey): string {
    return `${key.level}:${key.x}:${key.y}`
  }

  private emptyResult(): TiledSceneFrameResult {
    return {
      covered: false,
      pending: false,
      backgroundPending: false,
      metrics: emptyTileSchedulerMetrics(),
      fallbackTileCount: 0,
      uncoveredAreaCount: 1,
      uncoveredContentAreaCount: 1
    }
  }
}
