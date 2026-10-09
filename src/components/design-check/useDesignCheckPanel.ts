import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { useDesignCheckMessages } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  issueDetail,
  issueAction,
  issueSwatch,
  ruleHelp,
  ruleTitle
} from '@/app/editor/design-check/format'
import {
  countIssues,
  DESIGN_ISSUE_SEVERITIES,
  groupIssuesByRule,
  issuesWithin,
  type DesignIssue,
  type DesignIssueSeverity
} from '@/app/editor/design-check/issues'
import { IconFrame, sceneNodeIcon } from '@/app/editor/icons'
import { appPreferences } from '@/app/settings/preferences/store'

import type { IssueGroupView, IssueRowView } from './types'
import { usePresetLabels } from './usePresetLabels'

export type DesignCheckScope = 'page' | 'selection' | 'document'

export type DesignCheckEmptyState =
  | { kind: 'no-selection'; label: string; description: string }
  | { kind: 'filtered'; label: string }
  | { kind: 'clean'; label: string; description: string }

function isHidden(graph: SceneGraph, nodeId: string): boolean {
  let node = graph.getNode(nodeId)
  while (node) {
    if (!node.visible) return true
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return false
}

/**
 * State of the Lint panel: scope, filters, grouped rows and empty states. While the panel is
 * shown it keeps the design check running and brings focused issues into view in `list`.
 */
export function useDesignCheckPanel(options: {
  active: () => boolean
  list: Readonly<Ref<HTMLElement | null>>
}) {
  const store = useEditorStore()
  const messages = useDesignCheckMessages()
  const presetLabels = usePresetLabels()
  const check = store.designCheck

  const scope = ref<DesignCheckScope>('page')
  const visibleSeverities = ref<DesignIssueSeverity[]>([...DESIGN_ISSUE_SEVERITIES])
  /** Explicit open state per rule; suggestions start collapsed, problems start open. */
  const openGroups = reactive(new Map<string, boolean>())

  const snapshot = computed(() => {
    const current = check.snapshot.value
    return current?.pageId === store.state.currentPageId ? current : null
  })
  const selectedIds = computed(() => store.state.selectedIds)

  /** Every checked page's issues, in page order, the current page from its live check. */
  const documentIssues = computed<DesignIssue[]>(() => {
    const results = check.pages.results.value
    return store.graph
      .getPages()
      .flatMap((page) =>
        page.id === store.state.currentPageId
          ? (snapshot.value?.issues ?? [])
          : (results.get(page.id) ?? [])
      )
  })

  const scopedIssues = computed<DesignIssue[]>(() => {
    const issues = snapshot.value?.issues ?? []
    if (scope.value === 'page') return issues
    if (scope.value === 'document') return documentIssues.value
    return issuesWithin(issues, store.graph, selectedIds.value)
  })
  const counts = computed(() => countIssues(scopedIssues.value))
  const filtersActive = computed(
    () => visibleSeverities.value.length < DESIGN_ISSUE_SEVERITIES.length
  )

  function rowView(issue: DesignIssue): IssueRowView {
    void store.state.sceneVersion
    const node = store.graph.getNode(issue.nodeId)
    return {
      issue,
      layerName: node?.name ?? issue.nodeName,
      layerIcon: node ? sceneNodeIcon(node) : IconFrame,
      detail: issueDetail(issue, messages.value),
      swatch: issueSwatch(issue),
      action: node ? issueAction(issue, messages.value) : null,
      hidden: node ? isHidden(store.graph, node.id) : false,
      missing: !node,
      selected: selectedIds.value.has(issue.nodeId),
      pageLabel:
        issue.pageId === store.state.currentPageId
          ? null
          : messages.value.onPage({ page: store.graph.getNode(issue.pageId)?.name ?? '' })
    }
  }

  const groups = computed<IssueGroupView[]>(() =>
    groupIssuesByRule(
      scopedIssues.value.filter((issue) => visibleSeverities.value.includes(issue.severity))
    ).map((group) => {
      const rows = group.issues.map(rowView)
      const fixes = rows.flatMap(({ issue, missing }) =>
        issue.fix && !missing ? [{ nodeId: issue.nodeId, fix: issue.fix }] : []
      )
      return {
        ruleId: group.ruleId,
        severity: group.severity,
        title: ruleTitle(group.ruleId, messages.value),
        help: ruleHelp(group.ruleId, messages.value),
        rows,
        fixes,
        bindsOnly: fixes.every(({ fix }) => fix.kind === 'bind-variable')
      }
    })
  )

  /** Pages still waiting for their background check, while the document is listed. */
  const checkingDocument = computed(
    () => scope.value === 'document' && check.pages.queued.value.length > 0
  )

  /** Pages a large file has not loaded yet, which the document list cannot include. */
  const documentNote = computed(() => {
    const count = check.pages.notLoaded.value.length
    return scope.value === 'document' && count > 0
      ? messages.value.documentUnchecked({ count })
      : null
  })

  const emptyState = computed<DesignCheckEmptyState | null>(() => {
    if (!snapshot.value) return null
    if (checkingDocument.value && groups.value.length === 0) return null
    if (scope.value === 'selection' && selectedIds.value.size === 0) {
      return {
        kind: 'no-selection',
        label: messages.value.noSelection,
        description: messages.value.noSelectionDescription
      }
    }
    if (groups.value.length > 0) return null
    if (filtersActive.value && scopedIssues.value.length > 0) {
      return { kind: 'filtered', label: messages.value.noFilteredIssues }
    }
    const emptyLabels: Record<DesignCheckScope, string> = {
      page: messages.value.emptyPage,
      selection: messages.value.emptySelection,
      document: messages.value.emptyDocument
    }
    return {
      kind: 'clean',
      label: emptyLabels[scope.value],
      description: messages.value.emptyDescription({
        preset: presetLabels.value[appPreferences.value.designCheck.preset]
      })
    }
  })

  function isGroupOpen(group: IssueGroupView): boolean {
    return openGroups.get(group.ruleId) ?? group.severity !== 'info'
  }

  function setGroupOpen(ruleId: string, open: boolean) {
    openGroups.set(ruleId, open)
  }

  function clearFilters() {
    visibleSeverities.value = [...DESIGN_ISSUE_SEVERITIES]
  }

  /** Highlights a row's layer on the canvas; layers on other pages are not on screen. */
  function hoverRow(row: IssueRowView | null) {
    const onCanvas = row && !row.missing && row.issue.pageId === store.state.currentPageId
    check.highlightIssue(onCanvas ? row.issue : null)
  }

  watch(
    options.active,
    (visible) => {
      check.panelVisible.value = visible
      if (!visible) check.highlightIssue(null)
    },
    { immediate: true }
  )

  watch(
    () => options.active() && scope.value === 'document',
    (listing) => {
      check.documentScope.value = listing
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    check.panelVisible.value = false
    check.documentScope.value = false
    check.highlightIssue(null)
  })

  /** Shows the focused issue's row, e.g. after a canvas marker click: unfiltered, open, in view. */
  watch(
    [check.focusedIssueId, groups],
    async ([issueId], [previousId]) => {
      if (!issueId || issueId === previousId) return
      const issue = check.snapshot.value?.issues.find((candidate) => candidate.id === issueId)
      if (!issue) return
      if (!visibleSeverities.value.includes(issue.severity)) {
        visibleSeverities.value = [...visibleSeverities.value, issue.severity]
      }
      openGroups.set(issue.ruleId, true)
      await nextTick()
      options.list.value
        ?.querySelector(`[data-issue-id="${CSS.escape(issueId)}"]`)
        ?.scrollIntoView({ block: 'center' })
    },
    { flush: 'post' }
  )

  return {
    check,
    scope,
    visibleSeverities,
    counts,
    groups,
    emptyState,
    documentNote,
    loading: computed(
      () => snapshot.value === null || (checkingDocument.value && groups.value.length === 0)
    ),
    isGroupOpen,
    setGroupOpen,
    clearFilters,
    hoverRow
  }
}
