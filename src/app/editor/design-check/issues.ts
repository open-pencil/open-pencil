import {
  issueSeverityRank,
  type DesignIssueHighlight,
  type DesignIssueMarker,
  type DesignIssueSeverity
} from '@open-pencil/core/canvas'
import type { LintMessage } from '@open-pencil/core/lint'
import type { SceneGraph } from '@open-pencil/scene-graph'

export type { DesignIssueSeverity }

/** A lint message with an identity that survives re-checks while the finding persists. */
export interface DesignIssue extends LintMessage {
  id: string
  /** The page the layer is on. */
  pageId: string
}

export interface DesignIssueGroup {
  ruleId: string
  severity: DesignIssueSeverity
  issues: DesignIssue[]
}

export type DesignIssueCounts = Record<DesignIssueSeverity, number>

export const DESIGN_ISSUE_SEVERITIES: readonly DesignIssueSeverity[] = ['error', 'warning', 'info']

/** Sorts the most severe first. */
export function compareIssueSeverity(
  a: { severity: DesignIssueSeverity },
  b: { severity: DesignIssueSeverity }
): number {
  return issueSeverityRank(b.severity) - issueSeverityRank(a.severity)
}

/**
 * Identifies each finding by rule, layer and its position among that rule's findings on the
 * layer, so a row keeps its hover and focus state when an unrelated edit re-runs the check.
 */
export function toDesignIssues(messages: readonly LintMessage[], pageId: string): DesignIssue[] {
  const seen = new Map<string, number>()
  return messages.map((message) => {
    const base = `${message.ruleId}:${message.nodeId}`
    const index = seen.get(base) ?? 0
    seen.set(base, index + 1)
    return { ...message, id: `${base}:${index}`, pageId }
  })
}

export function countIssues(issues: readonly DesignIssue[]): DesignIssueCounts {
  const counts: DesignIssueCounts = { error: 0, warning: 0, info: 0 }
  for (const issue of issues) counts[issue.severity]++
  return counts
}

/**
 * One marker per layer with errors or warnings. Suggestions stay in the panel: they are
 * common enough that marking every one would bury the problems that need attention.
 */
export function markersForIssues(issues: readonly DesignIssue[]): DesignIssueMarker[] {
  const markers = new Map<string, DesignIssueMarker>()
  for (const issue of issues) {
    if (issue.severity === 'info') continue
    const marker = markers.get(issue.nodeId)
    if (!marker) {
      markers.set(issue.nodeId, { nodeId: issue.nodeId, severity: issue.severity, count: 1 })
      continue
    }
    marker.count++
    if (compareIssueSeverity(issue, marker) < 0) {
      marker.severity = issue.severity
    }
  }
  return [...markers.values()]
}

/** Groups findings by rule, most severe and then most frequent first; rows keep layer order. */
export function groupIssuesByRule(issues: readonly DesignIssue[]): DesignIssueGroup[] {
  const groups = new Map<string, DesignIssueGroup>()
  for (const issue of issues) {
    const group = groups.get(issue.ruleId)
    if (group) group.issues.push(issue)
    else
      groups.set(issue.ruleId, { ruleId: issue.ruleId, severity: issue.severity, issues: [issue] })
  }
  return [...groups.values()].sort(
    (a, b) =>
      compareIssueSeverity(a, b) ||
      b.issues.length - a.issues.length ||
      a.ruleId.localeCompare(b.ruleId)
  )
}

/** Findings on the given layers or anywhere inside them. */
export function issuesWithin(
  issues: readonly DesignIssue[],
  graph: Pick<SceneGraph, 'getNode'>,
  rootIds: ReadonlySet<string>
): DesignIssue[] {
  if (rootIds.size === 0) return []
  const inside = new Map<string, boolean>()
  function isInside(nodeId: string): boolean {
    const known = inside.get(nodeId)
    if (known !== undefined) return known
    const node = graph.getNode(nodeId)
    const result = rootIds.has(nodeId) || (!!node?.parentId && isInside(node.parentId))
    inside.set(nodeId, result)
    return result
  }
  return issues.filter((issue) => isInside(issue.nodeId))
}

function numberData(issue: DesignIssue, key: string): number | undefined {
  const value = issue.data?.[key]
  return typeof value === 'number' ? value : undefined
}

export function highlightForIssue(issue: DesignIssue): DesignIssueHighlight {
  const minSize = issue.ruleId === 'touch-target-size' ? numberData(issue, 'minSize') : undefined
  return {
    nodeId: issue.nodeId,
    severity: issue.severity,
    minSize: minSize ? { width: minSize, height: minSize } : undefined
  }
}

export function mostSevereIssue(issues: readonly DesignIssue[]): DesignIssue | undefined {
  let result: DesignIssue | undefined
  for (const issue of issues) {
    if (!result || compareIssueSeverity(issue, result) < 0) result = issue
  }
  return result
}
