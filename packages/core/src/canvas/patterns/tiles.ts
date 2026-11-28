import type { Shader } from '@open-pencil/canvaskit'
import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { createPatternSourceLookup } from '@open-pencil/scene-graph/paints'
import { appendAll } from '@open-pencil/std/arrays'

import { ResourceCache } from '#core/cache/resource'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

const MAX_PATTERN_TILES = 64

interface PatternTile {
  shader: Shader
  sourceId: string
}

function addLink(links: Map<string, Set<string>>, from: string, to: string): void {
  const linked = links.get(from)
  if (linked) {
    linked.add(to)
  } else {
    links.set(from, new Set([to]))
  }
}

function removeLink(links: Map<string, Set<string>>, from: string, to: string): void {
  const linked = links.get(from)
  linked?.delete(to)
  if (linked?.size === 0) {
    links.delete(from)
  }
}

export class PatternTargets {
  private readonly targetsBySource = new Map<string, Set<string>>()
  private readonly sourcesByTarget = new Map<string, Set<string>>()

  get targetCount(): number {
    return this.sourcesByTarget.size
  }

  add(sourceId: string, targetId: string): void {
    addLink(this.targetsBySource, sourceId, targetId)
    addLink(this.sourcesByTarget, targetId, sourceId)
  }

  takeTargetsOf(sourceId: string): Set<string> {
    const targets = this.targetsBySource.get(sourceId) ?? new Set<string>()
    this.targetsBySource.delete(sourceId)
    for (const targetId of targets) {
      removeLink(this.sourcesByTarget, targetId, sourceId)
    }
    return targets
  }

  forgetTarget(targetId: string): void {
    for (const sourceId of this.sourcesByTarget.get(targetId) ?? []) {
      removeLink(this.targetsBySource, sourceId, targetId)
    }
    this.sourcesByTarget.delete(targetId)
  }

  clear(): void {
    this.targetsBySource.clear()
    this.sourcesByTarget.clear()
  }
}

export class PatternTiles {
  readonly shaders = new ResourceCache<string, PatternTile>({
    maxEntries: MAX_PATTERN_TILES,
    dispose: (tile) => tile.shader.delete()
  })
  readonly unresolvedSources = new Set<string>()
  readonly sourcesInProgress = new Set<string>()
  private findSource: ((sourceId: string) => SceneNode | null) | null = null

  constructor(
    private graph: SceneGraph | null = null,
    private fontGeneration = -1,
    readonly targets = new PatternTargets()
  ) {}

  prepare(graph: SceneGraph, fontGeneration: number): void {
    if (graph === this.graph && fontGeneration === this.fontGeneration) {
      return
    }
    this.clear()
    this.graph = graph
    this.fontGeneration = fontGeneration
  }

  clear(): void {
    this.dropTiles()
    this.targets.clear()
  }

  dropTiles(): void {
    this.shaders.clear()
    this.forgetSourceLookups()
  }

  forGraphSharingTargets(graph: SceneGraph, fontGeneration: number): PatternTiles {
    return new PatternTiles(graph, fontGeneration, this.targets)
  }

  resolveSource(graph: SceneGraph, sourceId: string): SceneNode | null {
    this.findSource ??= createPatternSourceLookup(graph)
    const source = this.findSource(sourceId)
    if (!source) {
      this.unresolvedSources.add(sourceId)
    }
    return source
  }

  private forgetSourceLookups(): void {
    this.unresolvedSources.clear()
    this.findSource = null
  }

  addTarget(sourceId: string, targetId: string): void {
    this.targets.add(sourceId, targetId)
  }

  takeTargetsOfSourcesAround(nodeId: string): string[] {
    this.forgetSourceLookups()
    const graph = this.graph
    if (!graph || (this.targets.targetCount === 0 && this.shaders.size === 0)) {
      return []
    }
    const targets: string[] = []
    this.takeTargetsOfSource(nodeId, targets)
    const importedId = graph.getNode(nodeId)?.source.id
    if (importedId) {
      this.takeTargetsOfSource(importedId, targets)
    }
    graph.closest(nodeId, (ancestor) => {
      this.takeTargetsOfSource(ancestor.id, targets)
      return false
    })
    return targets
  }

  private takeTargetsOfSource(sourceId: string, targets: string[]): void {
    this.shaders.deleteWhere((tile) => tile.sourceId === sourceId)
    appendAll(targets, this.targets.takeTargetsOf(sourceId))
  }
}

export function patternTileKey(sourceId: string, fill: Fill): string {
  const spacing = fill.patternSpacing ?? { x: 0, y: 0 }
  return [
    sourceId,
    fill.scale ?? 1,
    spacing.x,
    spacing.y,
    fill.patternTileType ?? 'RECTANGULAR',
    fill.horizontalAlignment ?? 'START',
    fill.verticalAlignment ?? 'START'
  ].join(':')
}

const tilesByRenderer = new WeakMap<SkiaRenderer, PatternTiles>()

export function patternTilesOf(r: SkiaRenderer): PatternTiles {
  const existing = tilesByRenderer.get(r)
  if (existing) {
    return existing
  }
  const tiles = new PatternTiles()
  tilesByRenderer.set(r, tiles)
  return tiles
}

export function clearPatternTiles(r: SkiaRenderer): void {
  tilesByRenderer.get(r)?.clear()
}

export function withExportPatternTiles<T>(r: SkiaRenderer, graph: SceneGraph, draw: () => T): T {
  const canvasTiles = patternTilesOf(r)
  const exportTiles = canvasTiles.forGraphSharingTargets(graph, r.fontGeneration)
  tilesByRenderer.set(r, exportTiles)
  try {
    return draw()
  } finally {
    exportTiles.dropTiles()
    tilesByRenderer.set(r, canvasTiles)
  }
}

export function invalidatePatternTargets(r: SkiaRenderer, nodeId: string): void {
  const tiles = tilesByRenderer.get(r)
  if (!tiles) {
    return
  }
  for (const targetId of tiles.takeTargetsOfSourcesAround(nodeId)) {
    r.redrawNode(targetId)
  }
}

export function forgetPatternTarget(r: SkiaRenderer, nodeId: string): void {
  tilesByRenderer.get(r)?.targets.forgetTarget(nodeId)
}

export function isRecordingPatternTile(r: SkiaRenderer): boolean {
  return (tilesByRenderer.get(r)?.sourcesInProgress.size ?? 0) > 0
}
