import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import {
  ISSUE_MARKER_GAP,
  ISSUE_MARKER_HEIGHT,
  ISSUE_MARKER_MAX_COUNT,
  ISSUE_MARKER_MIN_TARGET,
  ISSUE_MARKER_OFFSET,
  ISSUE_MARKER_PADDING_X,
  ISSUE_MARKER_VIEWPORT_INSET
} from '#core/constants'
import { createSceneGeometry, type RotationPreview, type ViewportTransform } from '#core/geometry'

import type { DesignIssueMarker, DesignIssueSeverity, PlacedIssueMarker } from './types'

export interface IssueMarkerView extends ViewportTransform {
  width: number
  height: number
  /** Space taken by chrome along the top and left edges, such as rulers. */
  insetTop: number
  insetLeft: number
}

export interface IssueMarkerLayoutOptions {
  pageId: string
  view: IssueMarkerView
  /** Layers whose markers would cover an active edit, such as the text being typed. */
  suppressedIds?: ReadonlySet<string>
  preview?: RotationPreview | null
  measureText: (text: string) => number
}

const SEVERITY_RANK: Record<DesignIssueSeverity, number> = { error: 3, warning: 2, info: 1 }

export function issueSeverityRank(severity: DesignIssueSeverity): number {
  return SEVERITY_RANK[severity]
}

export function issueMarkerLabel(count: number): string {
  if (count <= 1) return '!'
  return count > ISSUE_MARKER_MAX_COUNT ? `${ISSUE_MARKER_MAX_COUNT}+` : String(count)
}

export function issueMarkerWidth(count: number, measureText: (text: string) => number): number {
  const textWidth = measureText(issueMarkerLabel(count))
  return Math.max(ISSUE_MARKER_HEIGHT, Math.ceil(textWidth + ISSUE_MARKER_PADDING_X * 2))
}

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right < x || bottom < y) return null
  return { x, y, width: right - x, height: bottom - y }
}

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  )
}

function screenBounds(
  node: SceneNode,
  geometry: ReturnType<typeof createSceneGeometry>,
  view: ViewportTransform
): Rect {
  const points = Matrix.mapPoints(geometry.screenMatrix(node, view), [
    0,
    0,
    node.width,
    0,
    node.width,
    node.height,
    0,
    node.height
  ])
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < points.length; index += 2) {
    minX = Math.min(minX, points[index])
    maxX = Math.max(maxX, points[index])
    minY = Math.min(minY, points[index + 1])
    maxY = Math.max(maxY, points[index + 1])
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * The screen rectangle a layer's marker attaches to, or null when the layer should not be marked.
 *
 * Hidden and clipped-out layers stay listed in the panel but get no marker, so a marker never
 * points at empty canvas. A layer too small to point at on screen hands its marker to the nearest
 * ancestor that is large enough, so zoomed-out designs gather markers at frame corners instead of
 * scattering them over detail that cannot be seen.
 */
function markerTarget(
  graph: SceneGraph,
  node: SceneNode,
  pageId: string,
  geometry: ReturnType<typeof createSceneGeometry>,
  view: ViewportTransform
): Rect | null {
  const chain: SceneNode[] = []
  let current: SceneNode | undefined = node
  while (current) {
    if (!current.visible) return null
    chain.push(current)
    if (current.parentId === pageId) break
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  if (!current) return null

  // Clip each layer's bounds by the clipping ancestors above it, walking top-down. A clipping
  // layer that is entirely clipped away hides everything inside it.
  const visible = Array.from<Rect | null>({ length: chain.length })
  let clip: Rect | null = null
  for (let index = chain.length - 1; index >= 0; index--) {
    const layer = chain[index]
    const bounds = screenBounds(layer, geometry, view)
    const clipped: Rect | null = clip ? intersect(bounds, clip) : bounds
    visible[index] = clipped
    if (!layer.clipsContent) continue
    if (!clipped) return null
    clip = clipped
  }

  if (!visible[0]) return null
  for (let index = 0; index < chain.length; index++) {
    const bounds = visible[index]
    if (!bounds) continue
    const last = index === chain.length - 1
    if (last || Math.max(bounds.width, bounds.height) >= ISSUE_MARKER_MIN_TARGET) return bounds
  }
  return visible[0]
}

interface Candidate {
  marker: DesignIssueMarker
  anchor: Vector
}

/**
 * Places one marker at the outer top-right corner of each marked layer, then merges markers that
 * would overlap. Merging keeps the position of the most severe marker, so the canvas never shows
 * a warning on top of an error it hides.
 */
export function layoutIssueMarkers(
  graph: SceneGraph,
  markers: readonly DesignIssueMarker[],
  options: IssueMarkerLayoutOptions
): PlacedIssueMarker[] {
  const { view, pageId, suppressedIds, measureText } = options
  const geometry = createSceneGeometry(graph, options.preview)
  const viewport: Rect = {
    x: view.insetLeft,
    y: view.insetTop,
    width: Math.max(0, view.width - view.insetLeft),
    height: Math.max(0, view.height - view.insetTop)
  }

  const candidates: Candidate[] = []
  for (const marker of markers) {
    if (marker.count <= 0 || suppressedIds?.has(marker.nodeId)) continue
    const node = graph.getNode(marker.nodeId)
    if (!node) continue
    const bounds = markerTarget(graph, node, pageId, geometry, view)
    if (!bounds || !intersect(bounds, viewport)) continue
    candidates.push({ marker, anchor: { x: bounds.x + bounds.width, y: bounds.y } })
  }

  candidates.sort(
    (a, b) =>
      SEVERITY_RANK[b.marker.severity] - SEVERITY_RANK[a.marker.severity] ||
      a.anchor.y - b.anchor.y ||
      b.anchor.x - a.anchor.x
  )

  const minX = viewport.x + ISSUE_MARKER_VIEWPORT_INSET
  const minY = viewport.y + ISSUE_MARKER_VIEWPORT_INSET
  const maxRight = view.width - ISSUE_MARKER_VIEWPORT_INSET
  const maxBottom = view.height - ISSUE_MARKER_VIEWPORT_INSET

  function rectAt(anchor: Vector, count: number): Rect {
    const width = issueMarkerWidth(count, measureText)
    const x = Math.min(Math.max(anchor.x + ISSUE_MARKER_OFFSET, minX), maxRight - width)
    const y = Math.min(
      Math.max(anchor.y - ISSUE_MARKER_OFFSET - ISSUE_MARKER_HEIGHT, minY),
      maxBottom - ISSUE_MARKER_HEIGHT
    )
    return { x: Math.round(x), y: Math.round(y), width, height: ISSUE_MARKER_HEIGHT }
  }

  const placed: PlacedIssueMarker[] = []
  for (const { marker, anchor } of candidates) {
    const rect = rectAt(anchor, marker.count)
    const target = placed.find((existing) => overlaps(existing.rect, rect, ISSUE_MARKER_GAP))
    if (target) {
      target.nodeIds.push(marker.nodeId)
      target.count += marker.count
      target.rect = rectAt(target.anchor, target.count)
      continue
    }
    placed.push({
      key: marker.nodeId,
      nodeIds: [marker.nodeId],
      severity: marker.severity,
      count: marker.count,
      rect,
      anchor
    })
  }
  return placed
}

/** Topmost marker under a screen point; markers placed first are drawn on top. */
export function hitTestIssueMarkers(
  placed: readonly PlacedIssueMarker[],
  x: number,
  y: number
): PlacedIssueMarker | null {
  for (const marker of placed) {
    const { rect } = marker
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
      return marker
    }
  }
  return null
}
