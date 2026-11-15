import { tileLevel, type TileWorldBounds } from './geometry'
import { pageBackdropPlan, type TilePlanOptions } from './planner'

/** The backdrop is this many times coarser than the visible level, and reaches this far out. */
const BACKDROP_LEVEL_RATIO = 4
const BACKDROP_OVERSCAN = 1
/** How many halvings of the visible level the pyramid keeps: 2⁶ covers a 64× zoom out. */
const PYRAMID_LEVELS = 6

/**
 * The levels of the background stages planned around a visible `level`: the backdrop around
 * the viewport and the whole-page copy, absent when the visible level is already that coarse.
 */
export interface TileStageLevels {
  backdrop: number
  pageBackdrop: TilePlanOptions['pageBackdrop']
}

/** The background stage levels for the visible `level` over a page whose content is `bounds`. */
export function tileStageLevels(level: number, bounds: TileWorldBounds | null): TileStageLevels {
  return {
    backdrop: tileLevel((level / BACKDROP_LEVEL_RATIO) * (1 - 1e-9)),
    pageBackdrop: pageBackdropPlan(bounds, level)
  }
}

/**
 * The levels a frame's plan needs at `level`: the visible one, the backdrop and page copy, and
 * every pyramid level, whose eviction the tile cache counts.
 */
export function plannedTileLevels(level: number, stages: TileStageLevels): Set<number> {
  const watched = new Set([level, stages.backdrop])
  if (stages.pageBackdrop) watched.add(stages.pageBackdrop.level)
  for (let depth = 1; depth <= PYRAMID_LEVELS; depth++) watched.add(level / 2 ** depth)
  return watched
}

/** Adds the backdrop, the page copy, and the pyramid to the plan. */
export function addBackgroundStages(options: TilePlanOptions, stages: TileStageLevels): void {
  options.backdrop = { level: stages.backdrop, overscanTiles: BACKDROP_OVERSCAN }
  options.pageBackdrop = stages.pageBackdrop
  options.pyramid = { levels: PYRAMID_LEVELS }
}

/** Leaves the plan the visible tiles alone: no overscan ring and no background stages. */
export function dropBackgroundStages(options: TilePlanOptions): void {
  options.overscanTiles = 0
  delete options.backdrop
  delete options.pageBackdrop
  delete options.pyramid
}
