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
import { TileCostModel } from './cost'
import { exactTileLevel, type TileKey, tileLevel, type TileWorldBounds } from './geometry'
import { pageBackdropPlan, type TilePlan, planTiles, type TilePlanOptions } from './planner'
import { drawPresentation, resolveVisible, type VisiblePresentation } from './presentation'
import {
  childTileKeys,
  deleteRenderedTile,
  downsampleTile,
  estimateTileCost,
  recordTilePictures,
  renderTile,
  tileJobResult
} from './render'
import {
  emptyTileSchedulerMetrics,
  TileScheduler,
  type TileJob,
  type TileSchedulerMetrics
} from './scheduler'
import {
  applyInvalidations,
  applyStructureChanges,
  type PageTiles,
  type PendingInvalidation,
  type PendingStructureChange
} from './structure'
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
/**
 * How long after a content change the background stages wait: an edit in progress, such as
 * typing, invalidates the page copy and the backdrop under it at every keystroke, and a coarse
 * tile over thousands of chunks costs a frame or more to render from the scene, so they are
 * rebuilt once the content has been still for this long.
 */
const BACKGROUND_QUIET_MS = 300
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
  private pendingInvalidations: PendingInvalidation[] = []
  /** Layers added, removed, moved between parents, or changed in kind since the last frame. */
  private pendingStructure: PendingStructureChange[] = []
  private lastCoveredGeneration = ''
  private lastLevel: number | null = null
  /**
   * The level whose visible tiles have all been presented at once. Another level's tiles are
   * held back, with the nearest level scaled in their place, until every visible one exists, so
   * a zoom ends with the viewport sharpening in one frame rather than tile by tile. The level
   * once committed, tiles a pan reveals or an edit renews present as they land.
   */
  private committedLevel: number | null = null
  /**
   * Set when a frame of background work evicted a tile its own plan needs: the cache cannot hold
   * the plan, so the stages stop rather than render each other out until the view changes.
   */
  private backgroundSaturated = false
  /** When the content last changed, so the background stages wait for a quiet spell. */
  private lastContentChangeAt = Number.NEGATIVE_INFINITY
  /** The last frame withheld the background stages for the quiet spell: frames must go on. */
  private backgroundWaiting = false
  private readonly tileCacheBudget: (viewportBytes: number) => number
  private readonly pictureCache = new RenderChunkPictureCache()
  private readonly tileCache = new TileImageCache()
  private readonly surfacePool = new TileSurfacePool()
  private readonly scheduler: TileScheduler
  private readonly costs = new TileCostModel()

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
      this.invalidateStructure(nodeId, node.parentId)
      return
    }
    this.pendingInvalidations.push({
      nodeId,
      previousBounds: chunks.map(({ minX, minY, maxX, maxY }) => ({ minX, minY, maxX, maxY }))
    })
  }

  /**
   * A structural change: `nodeId` was added, removed, moved under another parent, or changed in
   * a way that reshapes its chunks. The page child whose subtree holds it is rebuilt at the next
   * frame, with its pictures and the tiles it touched; the rest of the page keeps its tiles.
   * Without a layer, as when a document loads or is replaced, everything is dropped.
   */
  invalidateStructure(nodeId?: string, parentId?: string | null): void {
    if (nodeId === undefined) {
      this.invalidate()
      return
    }
    if (!this.index) return
    this.pendingStructure.push({ nodeId, parentId: parentId ?? null })
  }

  /**
   * Whether invalidations recorded since the last frame still await it. Unlike the renderer's
   * settlement flags, this is current between frames; queued background jobs do not count, as
   * settlement means the visible tiles.
   */
  hasPendingWork(): boolean {
    return this.pendingInvalidations.length > 0 || this.pendingStructure.length > 0
  }

  /** The tile cache's current byte budget. */
  tileCacheBytes(): number {
    return this.tileCache.budget()
  }

  /**
   * Renders due tiles within the frame's budget and presents the viewport from the cache: exact
   * tiles where they exist, the nearest level's tiles scaled where they do not, and the page
   * colour where no level has one, until its tile renders. Nothing is drawn straight from the
   * scene, whose whole-page picture a large document cannot afford. Navigation keeps presenting
   * and renders under a shorter budget: the exact level while panning or paused, and while the
   * zoom level moves the quantized step at or above the scale, whose tiles outlive the frame and
   * stand in, scaled by a fifth at most, until the exact level is complete; the retained backing
   * plays no part. Idle time builds a pyramid of downsampled copies and a scene-rendered
   * backdrop around the viewport, so a zoom out finds scaled stand-ins.
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

    // A zoom in motion changes the exact level every frame, and a tile rendered at it is obsolete
    // within a few frames, so while the level moves the frame renders the quantized step at or
    // above the scale instead: its tiles serve every frame until the zoom crosses the next step,
    // and then stand in for the exact level, scaled down by a fifth at most. A zoom that pauses,
    // and a pan, render the exact level under the moving budget.
    const scale = renderer.zoom * renderer.dpr
    const level = exactTileLevel(scale)
    const zooming = renderer.navigationPhase === 'zoom' && level !== this.lastLevel
    const renderLevel = zooming ? tileLevel(scale) : level
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
      renderLevel,
      viewport,
      contentGeneration,
      navigationGeneration
    )
    const plan = planTiles(this.tileCache, planOptions)
    this.scheduler.enqueue(plan.jobs)
    const metrics = this.scheduler.runFrame(
      (job, remainingMs) => this.executeJob(renderer, graph, index, job, remainingMs),
      this.navigationActive ? NAVIGATION_TILE_BUDGET_MS : TILE_FRAME_BUDGET_MS,
      this.firstJobLimit()
    )
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
    const presentation = this.presentLevel(visible, renderer.pageId, level, index.bounds())
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
      backgroundPending:
        !this.navigationActive && (this.scheduler.pending() > 0 || this.backgroundWaiting),
      metrics,
      fallbackTileCount: presentation.fallback.length,
      uncoveredAreaCount: presentation.uncovered,
      uncoveredContentAreaCount: presentation.uncoveredContent
    }
  }

  /**
   * A level arrives whole: until every visible tile exists, those that do stay hidden behind
   * the nearest level, which the zoom just rendered, or behind the page colour when a page is
   * first shown, and the level is committed once they all exist, after which tiles present as
   * they land.
   */
  private presentLevel(
    visible: TilePlan['visible'],
    pageId: string,
    level: number,
    content: TileWorldBounds | null
  ): VisiblePresentation {
    if (this.committedLevel !== level && visible.every(({ tile }) => tile !== null)) {
      this.committedLevel = level
    }
    const presented =
      this.committedLevel === level ? visible : visible.map(({ key }) => ({ key, tile: null }))
    return resolveVisible(this.tileCache, presented, pageId, level, content)
  }

  invalidate(): void {
    this.cancelledJobs += this.scheduler.clear()
    this.index?.dispose()
    this.index = null
    this.pageId = null
    this.contentGeneration = -1
    this.lastCoveredGeneration = ''
    this.lastLevel = null
    this.committedLevel = null
    this.lastContentChangeAt = Number.NEGATIVE_INFINITY
    this.backgroundWaiting = false
    this.pendingInvalidations = []
    this.pendingStructure = []
    this.costs.clear()
    this.pictureCache.clear()
    this.tileCache.clear()
  }

  destroy(): void {
    this.invalidate()
    this.cancelledJobs = 0
    this.navigationGeneration = -1
    this.navigationActive = false
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
    if (this.index && this.pageId === renderer.pageId && this.pendingStructure.length > 0) {
      this.applyPendingStructure(graph, contentGeneration)
    }
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
    const page = this.pageTiles()
    if (!page) return
    applyInvalidations(page, graph, this.pendingInvalidations, contentGeneration)
    if (this.pendingInvalidations.length > 0) this.lastContentChangeAt = this.now()
    this.pendingInvalidations = []
    this.contentGeneration = contentGeneration
  }

  private applyPendingStructure(graph: SceneGraph, contentGeneration: number): void {
    const page = this.pageTiles()
    if (!page) return
    if (!applyStructureChanges(page, graph, this.pendingStructure, contentGeneration)) {
      this.invalidate()
      return
    }
    this.pendingStructure = []
    this.contentGeneration = contentGeneration
    this.lastContentChangeAt = this.now()
  }

  private pageTiles(): PageTiles | null {
    if (!this.index || !this.pageId) return null
    return {
      index: this.index,
      pageId: this.pageId,
      pictureCache: this.pictureCache,
      tileCache: this.tileCache
    }
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
    const pageBackdrop = pageBackdropPlan(index.bounds(), level)
    if (pageBackdrop) this.tileCache.touchLevel(pageId, pageBackdrop.level)
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
      estimateCost: (key) =>
        estimateTileCost(
          renderer,
          index,
          this.pictureCache,
          this.costs,
          key,
          this.navigationActive
        ),
      globalFallbackAvailable: true
    }
    // Background stages wait for idle, a moving frame having only its budget to give, and for
    // the content to have been still a while, so an edit in progress rebuilds the visible tiles
    // alone.
    const quiet = this.now() - this.lastContentChangeAt >= BACKGROUND_QUIET_MS
    const background = !this.navigationActive && !this.backgroundSaturated && quiet
    this.backgroundWaiting = !this.navigationActive && !this.backgroundSaturated && !quiet
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
      !recordTilePictures(renderer, graph, index, this.pictureCache, job.key, {
        now: this.now,
        remainingMs
      })
    ) {
      return { renderMs: this.now() - startedAt, overBudget: false, deferred: true }
    }
    const tile =
      job.kind === 'downsample'
        ? this.downsample(renderer, job)
        : renderTile(renderer, graph, index, job.key, this.pictureCache, this.surfacePool)
    if (!tile) return { renderMs: 0, overBudget: job.kind !== 'downsample' }
    if (job.kind !== 'downsample') {
      this.costs.record(job.key, this.now() - startedAt, tile.chunkCount)
    }
    if (
      job.navigationGeneration !== this.navigationGeneration ||
      job.contentGeneration !== this.contentGeneration
    ) {
      deleteRenderedTile(tile)
      return tileJobResult(tile, TILE_FRAME_BUDGET_MS)
    }
    this.tileCache.takeWatchedEvictions()
    this.tileCache.install(tile, job.contentGeneration)
    if (job.priority === 'overscan' && this.tileCache.takeWatchedEvictions() > 0) {
      this.backgroundSaturated = true
    }
    return tileJobResult(tile, TILE_FRAME_BUDGET_MS)
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

  /** Whether the cache holds a fresh tile for `key`. */
  isRendered(key: TileKey): boolean {
    return this.tileCache.getIfPresent(key)?.contentGeneration === this.contentGeneration
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
