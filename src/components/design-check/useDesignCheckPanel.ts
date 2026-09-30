import { computed, reactive, ref } from 'vue'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { useDesignCheckMessages } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  issueDetail,
  issueFix,
  issueSwatch,
  ruleHelp,
  ruleTitle,
  type IssueFix
} from '@/app/editor/design-check/format'
import {
  countIssues,
  DESIGN_ISSUE_SEVERITIES,
  groupIssuesByRule,
  issuesWithin,
  type DesignIssue,
  type DesignIssueSeverity
} from '@/app/editor/design-check/issues'
import { nodeIcon } from '@/app/editor/icons'

import type { IssueGroupView, IssueRowView } from './types'

export type DesignCheckScope = 'page' | 'selection'

function isHidden(graph: SceneGraph, nodeId: string): boolean {
  let node = graph.getNode(nodeId)
  while (node) {
    if (!node.visible) return true
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return false
}

export function useDesignCheckPanel() {
  const store = useEditorStore()
  const messages = useDesignCheckMessages()
  const check = store.designCheck

  const scope = ref<DesignCheckScope>('page')
  const filters = reactive<Record<DesignIssueSeverity, boolean>>({
    error: true,
    warning: true,
    info: true
  })
  /** Explicit open state per rule; suggestions start collapsed, problems start open. */
  const openGroups = reactive(new Map<string, boolean>())

  const snapshot = computed(() => {
    const current = check.snapshot.value
    return current?.pageId === store.state.currentPageId ? current : null
  })
  const selectedIds = computed(() => store.state.selectedIds)
  const hasSelection = computed(() => selectedIds.value.size > 0)

  const scopedIssues = computed<DesignIssue[]>(() => {
    const issues = snapshot.value?.issues ?? []
    if (scope.value === 'page') return issues
    return issuesWithin(issues, store.graph, selectedIds.value)
  })
  const counts = computed(() => countIssues(scopedIssues.value))
  const visibleIssues = computed(() =>
    scopedIssues.value.filter((issue) => filters[issue.severity])
  )
  const filtersActive = computed(() =>
    DESIGN_ISSUE_SEVERITIES.some((severity) => !filters[severity])
  )

  function rowView(issue: DesignIssue): IssueRowView {
    void store.state.sceneVersion
    const node = store.graph.getNode(issue.nodeId)
    return {
      issue,
      layerName: node?.name ?? issue.nodeName,
      layerIcon: nodeIcon(node ?? { type: 'FRAME', layoutMode: 'NONE' }),
      detail: issueDetail(issue, messages.value),
      swatch: issueSwatch(issue),
      fix: node ? issueFix(issue) : null,
      hidden: node ? isHidden(store.graph, node.id) : false,
      missing: !node,
      selected: selectedIds.value.has(issue.nodeId)
    }
  }

  const groups = computed<IssueGroupView[]>(() =>
    groupIssuesByRule(visibleIssues.value).map((group) => {
      const rows = group.issues.map(rowView)
      return {
        ruleId: group.ruleId,
        severity: group.severity,
        title: ruleTitle(group.ruleId, messages.value),
        help: ruleHelp(group.ruleId, messages.value),
        rows,
        fixes: rows.flatMap((row) => (row.fix ? [row.fix] : []))
      }
    })
  )

  function isGroupOpen(group: IssueGroupView): boolean {
    return openGroups.get(group.ruleId) ?? group.severity !== 'info'
  }

  function setGroupOpen(ruleId: string, open: boolean) {
    openGroups.set(ruleId, open)
  }

  function toggleFilter(severity: DesignIssueSeverity) {
    filters[severity] = !filters[severity]
  }

  function clearFilters() {
    for (const severity of DESIGN_ISSUE_SEVERITIES) filters[severity] = true
  }

  /** Makes sure the row for an issue is rendered: in scope, not filtered, group open. */
  function revealIssueRow(issue: DesignIssue) {
    filters[issue.severity] = true
    openGroups.set(issue.ruleId, true)
  }

  function applyFixes(fixes: readonly IssueFix[]) {
    check.applyFixes(fixes)
  }

  return {
    check,
    scope,
    filters,
    hasSelection,
    counts,
    groups,
    filtersActive,
    loading: computed(() => snapshot.value === null),
    isGroupOpen,
    setGroupOpen,
    toggleFilter,
    clearFilters,
    revealIssueRow,
    applyFixes
  }
}
