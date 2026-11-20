// Figma's equal spacing laid over a move's snap: the gap the box matches wins an axis edge
// alignment does not land closer on, and no guide or path vertex claims.
import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { computeSpacingSnap, type SpacingAxisResult } from '@open-pencil/scene-graph/equal-spacing'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

import { snappingThreshold, type ObjectPixelSnapResult } from '#vue/shared/input/snap/resolve'

/** A guide from a canvas guide, a layout guide, or a path vertex: those keep their axis. */
function isExplicitGuide(guide: SnapGuide): boolean {
  return 'kind' in guide
}

function spacingTakesAxis(
  spacing: SpacingAxisResult | null,
  axisGuides: SnapGuide[],
  correction: number
): spacing is SpacingAxisResult {
  if (!spacing || spacing.guides.length === 0) return false
  if (axisGuides.some(isExplicitGuide)) return false
  // An edge alignment on this axis keeps it when it lands at least as close.
  return axisGuides.length === 0 || Math.abs(spacing.delta) < Math.abs(correction)
}

/**
 * The move's snap with equal spacing applied per axis: where it wins, its delta replaces the
 * axis's correction and its gaps replace the axis's guides.
 */
export function withEqualSpacing(
  snap: ObjectPixelSnapResult,
  movingIds: ReadonlySet<string>,
  movingBounds: Rect,
  targets: SceneNode[],
  editor: Editor
): ObjectPixelSnapResult {
  if (!editor.state.snappingPreferences.objects) return snap
  const spacing = computeSpacingSnap(movingIds, movingBounds, targets, snappingThreshold(editor))
  const correction = { ...snap.correction }
  let guides = snap.guides
  for (const axis of ['x', 'y'] as const) {
    const axisGuides = guides.filter((guide) => guide.axis === axis)
    const result = spacing[axis]
    if (!spacingTakesAxis(result, axisGuides, correction[axis])) continue
    correction[axis] = result.delta
    guides = [...guides.filter((guide) => guide.axis !== axis), ...result.guides]
  }
  return { correction, guides }
}
