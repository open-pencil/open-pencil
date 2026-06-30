import { orderBy } from 'es-toolkit/array'

import type { FigmaAPI } from '#core/figma-api'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import { defineTool } from '#core/tools/schema'

import {
  buildParentOverflowResult,
  buildSiblingOverlapResult,
  computeNodeBounds,
  filterNodes,
  findPageId,
  findPageIdByName,
  matchesParentOverflowScope,
  matchesScope,
  pairRelationship,
  passesThresholds,
  scoredSeverity,
  type BoundsEntry
} from './helpers'
import {
  parseOverlapCategories as parseCategoryFilter,
  parseOverlapScope as toScope,
  parseOverlapSeverity as parseSeverity
} from './params'

export type OverlapSeverity = 'critical' | 'major' | 'minor' | 'info'

export type OverlapScope = 'all' | 'same-parent' | 'cross-parent' | 'top-level' | 'inside-parent'

export type OverlapCategory = 'sibling-overlap' | 'parent-overflow' | 'overlay'

export { findPageId, findPageIdByName }

export interface OverlapNodeSummary {
  id: string
  name: string
  type: string
  parentId: string | null
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
}

export interface OverlapIntersection {
  x: number
  y: number
  width: number
  height: number
  area: number
}

export interface OverlapItem {
  category: OverlapCategory
  severity: OverlapSeverity
  message: string
  suggestion: string
  area: number
  ratio: number
  nodeA: OverlapNodeSummary
  nodeB: OverlapNodeSummary
  intersection: OverlapIntersection
}

export interface AnalyzeOverlapsArgs {
  scope?: OverlapScope
  category?: string
  severity?: OverlapSeverity
  min_area?: number
  min_ratio?: number
  include_hidden?: boolean
  include_locked?: boolean
  include_absolute?: boolean
  limit?: number
  /** Page name fallback; used only when `page_id` is not supplied. */
  page?: string
  /** Stable page ID; takes precedence over `page`. */
  page_id?: string
  type?: string
}

export interface AnalyzeOverlapsSummary {
  totalNodes: number
  analyzedNodes: number
  overlapCount: number
  byCategory: Record<OverlapCategory, number>
  bySeverity: Record<OverlapSeverity, number>
}

export interface AnalyzeOverlapsResult {
  overlaps: OverlapItem[]
  summary: AnalyzeOverlapsSummary
}

function buildBoundsCache(
  candidates: SceneNode[],
  graph: SceneGraph
): { boundsCache: Map<string, BoundsEntry>; entries: BoundsEntry[] } {
  const boundsCache = new Map<string, BoundsEntry>()
  const entries: BoundsEntry[] = []

  for (const node of candidates) {
    const cached = boundsCache.get(node.id)
    if (cached) {
      entries.push(cached)
      continue
    }
    const computed = computeNodeBounds(node, graph)
    if (computed.area <= 0) continue
    const entry: BoundsEntry = { node, ...computed }
    boundsCache.set(node.id, entry)
    entries.push(entry)
  }

  return { boundsCache, entries }
}

function collectParentOverflows(
  candidates: SceneNode[],
  graph: SceneGraph,
  boundsCache: Map<string, BoundsEntry>,
  scope: OverlapScope,
  minArea: number,
  minRatio: number,
  categoryFilter: OverlapCategory[] | undefined,
  severityFilter: OverlapSeverity | undefined
): OverlapItem[] {
  const overlaps: OverlapItem[] = []

  for (const child of candidates) {
    if (!child.parentId) continue
    const parent = graph.getNode(child.parentId)
    if (!parent || parent.type === 'CANVAS') continue
    const childEntry = boundsCache.get(child.id)
    if (!childEntry || childEntry.area <= 0) continue
    let parentEntry = boundsCache.get(parent.id)
    if (!parentEntry) {
      const computed = computeNodeBounds(parent, graph)
      if (computed.area <= 0) continue
      parentEntry = { node: parent, ...computed }
      boundsCache.set(parent.id, parentEntry)
    }
    const item = buildParentOverflowResult(child, childEntry.bounds, parent, parentEntry.bounds)
    if (
      item &&
      matchesParentOverflowScope(scope) &&
      passesThresholds(item, minArea, minRatio, categoryFilter, severityFilter)
    ) {
      overlaps.push(item)
    }
  }

  return overlaps
}

function collectSiblingOverlaps(
  entries: BoundsEntry[],
  graph: SceneGraph,
  scope: OverlapScope,
  minArea: number,
  minRatio: number,
  categoryFilter: OverlapCategory[] | undefined,
  severityFilter: OverlapSeverity | undefined
): OverlapItem[] {
  const overlaps: OverlapItem[] = []
  entries.sort((a, b) => a.bounds.minX - b.bounds.minX)

  for (let i = 0; i < entries.length; i++) {
    const entryA = entries[i]
    if (entryA.area <= 0) continue
    const maxX = entryA.bounds.maxX
    for (let j = i + 1; j < entries.length; j++) {
      const entryB = entries[j]
      if (entryB.bounds.minX > maxX) break
      if (entryB.bounds.maxY <= entryA.bounds.minY || entryB.bounds.minY >= entryA.bounds.maxY) {
        continue
      }

      const rel = pairRelationship(entryA.node, entryB.node, graph)
      if (rel.ancestor !== 'neither') continue
      if (!matchesScope(rel, scope)) continue

      const item = buildSiblingOverlapResult(
        entryA.node,
        entryA.bounds,
        entryB.node,
        entryB.bounds,
        graph
      )
      if (item && passesThresholds(item, minArea, minRatio, categoryFilter, severityFilter)) {
        overlaps.push(item)
      }
    }
  }

  return overlaps
}

function emptyByCategory(): Record<OverlapCategory, number> {
  return {
    'sibling-overlap': 0,
    'parent-overflow': 0,
    overlay: 0
  }
}

function emptyBySeverity(): Record<OverlapSeverity, number> {
  return {
    critical: 0,
    major: 0,
    minor: 0,
    info: 0
  }
}

/**
 * Compute overlap findings for a scoped subset of the graph.
 * Page, scope, type, and visibility filtering is applied via `args`.
 *
 * Heuristics implemented:
 *   - `sibling-overlap`: two non-ancestor nodes visually intersect.
 *   - `parent-overflow`: a child protrudes from a non-clipping parent.
 *   - `overlay`: a large node covers a much smaller sibling (modal/backdrop pattern).
 *
 * Filters:
 *   - hidden and locked nodes are skipped unless explicitly included
 *   - absolutely-positioned nodes are skipped unless explicitly included
 *   - ancestor/descendant pairs are never emitted as pair overlaps
 */
export function computeOverlaps(
  graph: SceneGraph,
  args: AnalyzeOverlapsArgs = {}
): AnalyzeOverlapsResult {
  const scope = toScope(args.scope) ?? 'all'
  const categoryFilter = parseCategoryFilter(args.category)
  const severityFilter = parseSeverity(args.severity)
  const minArea = Math.max(0, Number.isFinite(Number(args.min_area)) ? Number(args.min_area) : 0)
  const minRatio = Math.max(
    0,
    Math.min(1, Number.isFinite(Number(args.min_ratio)) ? Number(args.min_ratio) : 0)
  )

  const explicitPageName = args.page?.trim()
  const explicitPageId = args.page_id?.trim()
  let resolvedPageId: string | undefined
  if (explicitPageId) {
    resolvedPageId = explicitPageId
  } else if (explicitPageName) {
    resolvedPageId = findPageIdByName(graph, explicitPageName)
  } else {
    resolvedPageId = graph.getPages()[0]?.id
  }

  if (!resolvedPageId) {
    return {
      overlaps: [],
      summary: {
        totalNodes: 0,
        analyzedNodes: 0,
        overlapCount: 0,
        byCategory: emptyByCategory(),
        bySeverity: emptyBySeverity()
      }
    }
  }

  const resolvedArgs: AnalyzeOverlapsArgs = { ...args, page_id: resolvedPageId }

  const { candidates, totalNodes, analyzedNodes } = filterNodes(graph, resolvedArgs)
  const { boundsCache, entries } = buildBoundsCache(candidates, graph)

  const overlaps = [
    ...collectParentOverflows(
      candidates,
      graph,
      boundsCache,
      scope,
      minArea,
      minRatio,
      categoryFilter,
      severityFilter
    ),
    ...collectSiblingOverlaps(
      entries,
      graph,
      scope,
      minArea,
      minRatio,
      categoryFilter,
      severityFilter
    )
  ]

  const sorted = orderBy(
    overlaps,
    [(o) => scoredSeverity(o.severity), (o) => o.area],
    ['desc', 'desc']
  )

  const limit = Math.max(0, Number.isFinite(Number(args.limit)) ? Number(args.limit) : 100)
  // A limit of 0 (or a negative value clamped to 0) caps the returned overlaps
  // to an empty list. The summary totals still reflect the full `sorted` set.
  const trimmed = sorted.slice(0, limit)

  const byCategory = emptyByCategory()
  const bySeverity = emptyBySeverity()

  for (const item of sorted) {
    byCategory[item.category]++
    bySeverity[item.severity]++
  }

  return {
    overlaps: trimmed,
    summary: {
      totalNodes,
      analyzedNodes,
      overlapCount: sorted.length,
      byCategory,
      bySeverity
    }
  }
}

export const analyzeOverlaps = defineTool({
  name: 'analyze_overlaps',
  description:
    'Detect visual overlaps and layout overflows across the current page. Useful for finding content that covers footers, text that bleeds outside frames, and accidental sibling overlaps.',
  params: {
    scope: {
      type: 'string',
      description:
        'Which pairs to inspect: all, same-parent, cross-parent, top-level, inside-parent (default: all)',
      enum: ['all', 'same-parent', 'cross-parent', 'top-level', 'inside-parent'],
      default: 'all'
    },
    category: {
      type: 'string',
      description:
        'Comma-separated categories: sibling-overlap, parent-overflow, overlay (default: all)'
    },
    severity: {
      type: 'string',
      description: 'Minimum severity to include: critical, major, minor, info (default: info)',
      enum: ['critical', 'major', 'minor', 'info'],
      default: 'info'
    },
    min_area: {
      type: 'number',
      description: 'Minimum overlap area in square pixels (default: 0)'
    },
    min_ratio: {
      type: 'number',
      description: 'Minimum overlap ratio relative to the smaller node, 0.0–1.0 (default: 0)'
    },
    include_hidden: {
      type: 'boolean',
      description: 'Include hidden nodes in the analysis'
    },
    include_locked: {
      type: 'boolean',
      description: 'Include locked nodes in the analysis'
    },
    include_absolute: {
      type: 'boolean',
      description: 'Include absolutely-positioned nodes in the analysis'
    },
    page: {
      type: 'string',
      description: 'Limit analysis to nodes on the named page'
    },
    page_id: {
      type: 'string',
      description:
        'Limit analysis to nodes on the page with this stable ID (takes precedence over page)'
    },
    type: {
      type: 'string',
      description: 'Comma-separated node types to analyze, e.g. FRAME,TEXT'
    },
    limit: {
      type: 'number',
      description: 'Maximum overlap findings to return (default: 100)',
      default: 100
    }
  },
  execute: (figma: FigmaAPI, args) => {
    const page_id = args.page_id ?? (args.page ? undefined : figma.currentPageId)
    return computeOverlaps(figma.graph, { ...(args as AnalyzeOverlapsArgs), page_id })
  }
})
