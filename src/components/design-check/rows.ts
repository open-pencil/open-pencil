import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  issueAction,
  issueDetail,
  issueSwatch,
  ruleHelp,
  ruleTitle,
  type DesignCheckMessages
} from '@/app/editor/design-check/format'
import type { DesignIssue, DesignIssueGroup } from '@/app/editor/design-check/issues'
import { IconFrame, sceneNodeIcon } from '@/components/icons'

import type { IssueGroupView, IssueRowView } from './types'

/** What a row reads besides its issue: the document as it is now, and who is looking. */
export interface RowContext {
  graph: SceneGraph
  messages: DesignCheckMessages
  currentPageId: string
  selectedIds: ReadonlySet<string>
}

function isHidden(graph: SceneGraph, nodeId: string): boolean {
  let node = graph.getNode(nodeId)
  while (node) {
    if (!node.visible) return true
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return false
}

/** An issue's row, with its layer as it is now; a layer deleted since the check shows as missing. */
export function issueRowView(issue: DesignIssue, context: RowContext): IssueRowView {
  const { graph, messages } = context
  const node = graph.getNode(issue.nodeId)
  const onOtherPage = issue.pageId !== context.currentPageId
  return {
    issue,
    layerName: node?.name ?? issue.nodeName,
    layerIcon: node ? sceneNodeIcon(node) : IconFrame,
    detail: issueDetail(issue, messages),
    swatch: issueSwatch(issue),
    action: node ? issueAction(issue, messages) : null,
    hidden: node ? isHidden(graph, node.id) : false,
    missing: !node,
    selected: context.selectedIds.has(issue.nodeId),
    pageLabel: onOtherPage
      ? messages.onPage({ page: graph.getNode(issue.pageId)?.name ?? '' })
      : null
  }
}

/**
 * A rule's group with its first `shownRows` rows: each row reads its layer and a large page has
 * thousands of issues, so only rows on screen are built. Fixes skip deleted layers either way.
 */
export function issueGroupView(
  group: DesignIssueGroup,
  shownRows: number,
  context: RowContext
): IssueGroupView {
  const fixes = group.issues.flatMap(({ nodeId, fix }) =>
    fix && context.graph.getNode(nodeId) ? [{ nodeId, fix }] : []
  )
  return {
    ruleId: group.ruleId,
    severity: group.severity,
    title: ruleTitle(group.ruleId, context.messages),
    help: ruleHelp(group.ruleId, context.messages),
    count: group.issues.length,
    rows: group.issues.slice(0, shownRows).map((issue) => issueRowView(issue, context)),
    fixes,
    bindsOnly: fixes.every(({ fix }) => fix.kind === 'bind-variable')
  }
}
