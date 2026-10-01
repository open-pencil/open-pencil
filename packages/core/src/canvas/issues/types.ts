import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

export type DesignIssueSeverity = 'error' | 'warning' | 'info'

/** Issues reported on one layer, collapsed to what the canvas marker shows. */
export interface DesignIssueMarker {
  nodeId: string
  severity: DesignIssueSeverity
  count: number
}

/** A layer the user is inspecting through a marker or an issue row. */
export interface DesignIssueHighlight {
  nodeId: string
  severity: DesignIssueSeverity
  /** Minimum size the layer should reach, drawn as a ghost target around it. */
  minSize?: { width: number; height: number }
}

export interface DesignIssueOverlay {
  /** Layers to mark on the canvas; empty while markers are turned off. */
  markers: readonly DesignIssueMarker[]
  highlight: DesignIssueHighlight | null
  /** `key` of the placed marker under the pointer. */
  hoveredMarkerKey: string | null
}

/** A marker placed in screen space; nearby layers share one marker. */
export interface PlacedIssueMarker {
  /** Stable while the leading layer stays the same, for hover state. */
  key: string
  nodeIds: string[]
  severity: DesignIssueSeverity
  count: number
  /** Screen-space rectangle in CSS pixels. */
  rect: Rect
  /** Screen-space corner of the layer the marker is attached to. */
  anchor: Vector
  /**
   * Set for an edge pin: issues outside the viewport, pinned to its edge. A unit vector from the
   * viewport center toward them; `nodeIds` are ordered most severe first, then nearest.
   */
  direction?: Vector
}
