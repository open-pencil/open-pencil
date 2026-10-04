import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  compareIssueSeverity,
  type DesignIssue,
  type DesignIssueSeverity
} from '@/app/editor/design-check/issues'

/** What the Layers panel shows for a layer: its own issues, or issues inside it. */
export interface LayerIssueMark {
  /** The most severe issue on the layer itself, or inside it when it has none of its own. */
  severity: DesignIssueSeverity
  /** Errors and warnings on the layer itself. */
  count: number
  /** Whether the layer has issues of its own; otherwise they are in its descendants. */
  own: boolean
}

function moreSevere(a: DesignIssueSeverity, b: DesignIssueSeverity): DesignIssueSeverity {
  return compareIssueSeverity({ severity: a }, { severity: b }) <= 0 ? a : b
}

/**
 * Marks for the Layers panel, like an IDE marks files and the folders holding them: a layer
 * with errors or warnings is marked with the most severe, and each of its ancestors is marked
 * as containing one. Suggestions are left to the Lint panel, as on the canvas.
 */
export function layerIssueMarks(
  issues: readonly DesignIssue[],
  graph: SceneGraph
): Map<string, LayerIssueMark> {
  const marks = new Map<string, LayerIssueMark>()
  for (const issue of issues) {
    if (issue.severity === 'info') continue
    const mark = marks.get(issue.nodeId)
    marks.set(issue.nodeId, {
      severity: mark?.own ? moreSevere(mark.severity, issue.severity) : issue.severity,
      count: (mark?.own ? mark.count : 0) + 1,
      own: true
    })
    let parentId = graph.getNode(issue.nodeId)?.parentId
    while (parentId) {
      const parent = graph.getNode(parentId)
      if (!parent || parent.type === 'CANVAS') break
      const existing = marks.get(parentId)
      if (!existing) {
        marks.set(parentId, { severity: issue.severity, count: 0, own: false })
      } else if (!existing.own) {
        existing.severity = moreSevere(existing.severity, issue.severity)
      }
      parentId = parent.parentId
    }
  }
  return marks
}
