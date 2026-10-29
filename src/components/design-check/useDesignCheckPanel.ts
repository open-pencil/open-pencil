import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import {
  countIssues,
  DESIGN_ISSUE_SEVERITIES,
  groupIssuesByRule,
  issuesWithin,
  type DesignIssue,
  type DesignIssueSeverity
} from '@/app/editor/design-check/issues'
import type { DesignCheck } from '@/app/editor/design-check/session'
import { appPreferences } from '@/app/settings/preferences/store'

import { emptyState } from './empty-state'
import { issueGroupView, type RowContext } from './rows'
import type { DesignCheckScope, IssueGroupView, IssueRowView } from './types'
import { usePresetLabels } from './usePresetLabels'

/** Rows an open group shows at first, and how many more each "show more" adds. */
const ROW_PAGE = 50
const MORE_ROWS = ROW_PAGE * 4

/**
 * State of the Lint panel: scope, filters, grouped rows and empty states. While the panel is
 * shown it keeps the design check running and brings focused issues into view in `list`.
 */
export function useDesignCheckPanel(options: {
  active: () => boolean
  list: Readonly<Ref<HTMLElement | null>>
  initialScope?: DesignCheckScope
}) {
  const store = useEditorStore()
  const messages = useDesignCheckMessages()
  const presetLabels = usePresetLabels()
  const check = store.designCheck

  const scope = ref<DesignCheckScope>(options.initialScope ?? 'page')
  const visibleSeverities = ref<DesignIssueSeverity[]>([...DESIGN_ISSUE_SEVERITIES])
  /** Explicit open state per rule; suggestions start collapsed, problems start open. */
  const openGroups = reactive(new Map<string, boolean>())
  /** Rows shown per rule once more than the first page was asked for, until the list changes. */
  const rowLimits = reactive(new Map<string, number>())
  watch([options.active, () => store.state.currentPageId, scope], () => rowLimits.clear())

  // Issues in scope

  /** The current page's check, once it has caught up with a page switch. */
  const snapshot = computed(() => {
    const current = check.snapshot.value
    return current?.pageId === store.state.currentPageId ? current : null
  })

  const scopedIssues = computed<DesignIssue[]>(() => {
    const pageIssues = snapshot.value?.issues ?? []
    if (scope.value === 'page') return pageIssues
    if (scope.value === 'selection') {
      return issuesWithin(pageIssues, store.graph, store.state.selectedIds)
    }
    return documentIssues()
  })

  /** Every checked page's issues, in page order, the current page from its live check. */
  function documentIssues(): DesignIssue[] {
    const results = check.pages.results.value
    return store.graph
      .getPages()
      .flatMap((page) =>
        page.id === store.state.currentPageId
          ? (snapshot.value?.issues ?? [])
          : (results.get(page.id) ?? [])
      )
  }

  const counts = computed(() => countIssues(scopedIssues.value))

  // Groups and rows

  const filtersActive = computed(
    () => visibleSeverities.value.length < DESIGN_ISSUE_SEVERITIES.length
  )

  /** Empty while the panel is hidden: rows read every issue's layer, which nobody would see. */
  const groups = computed<IssueGroupView[]>(() => {
    if (!options.active()) return []
    const context = rowContext()
    const shown = scopedIssues.value.filter((issue) =>
      visibleSeverities.value.includes(issue.severity)
    )
    return groupIssuesByRule(shown).map((group) =>
      issueGroupView(group, isGroupOpen(group) ? rowLimit(group.ruleId) : 0, context)
    )
  })

  /**
   * Rows show layers as they are now, which Vue cannot track in the graph; the scene version
   * changes with them, so reading it here rebuilds the rows after an edit.
   */
  function rowContext(): RowContext {
    void store.state.sceneVersion
    return {
      graph: store.graph,
      messages: messages.value,
      currentPageId: store.state.currentPageId,
      selectedIds: store.state.selectedIds
    }
  }

  function isGroupOpen(group: Pick<IssueGroupView, 'ruleId' | 'severity'>): boolean {
    return openGroups.get(group.ruleId) ?? group.severity !== 'info'
  }

  function setGroupOpen(ruleId: string, open: boolean) {
    openGroups.set(ruleId, open)
  }

  function rowLimit(ruleId: string): number {
    return rowLimits.get(ruleId) ?? ROW_PAGE
  }

  function showMoreRows(ruleId: string) {
    rowLimits.set(ruleId, rowLimit(ruleId) + MORE_ROWS)
  }

  /** Shows a group's rows at least up to `index`, a whole page at a time. */
  function showRowsUpTo(ruleId: string, index: number) {
    if (index >= rowLimit(ruleId))
      rowLimits.set(ruleId, Math.ceil((index + 1) / ROW_PAGE) * ROW_PAGE)
  }

  function clearFilters() {
    visibleSeverities.value = [...DESIGN_ISSUE_SEVERITIES]
  }

  // Status

  /** Pages still waiting for their background check, while the document is listed. */
  const checkingDocument = computed(
    () => scope.value === 'document' && check.pages.queued.value.length > 0
  )

  const loading = computed(
    () => snapshot.value === null || (checkingDocument.value && groups.value.length === 0)
  )

  /** Pages a large file has not loaded yet, which the document list cannot include. */
  const documentNote = computed(() => {
    const count = check.pages.notLoaded.value.length
    return scope.value === 'document' && count > 0
      ? messages.value.documentUnchecked({ count })
      : null
  })

  const empty = computed(() =>
    loading.value
      ? null
      : emptyState(
          {
            scope: scope.value,
            hasSelection: store.state.selectedIds.size > 0,
            issueCount: scopedIssues.value.length,
            groupCount: groups.value.length,
            filtersActive: filtersActive.value,
            presetLabel: presetLabels.value[appPreferences.value.designCheck.preset]
          },
          messages.value
        )
  )

  // Canvas and focus

  /** Highlights a row's layer on the canvas; layers on other pages are not on screen. */
  function hoverRow(row: IssueRowView | null) {
    const onCanvas = row && !row.missing && row.issue.pageId === store.state.currentPageId
    check.highlightIssue(onCanvas ? row.issue : null)
  }

  /** Shows a focused issue's row, such as after a canvas marker click: unfiltered, open, in view. */
  async function revealIssue(issueId: string) {
    const issue = check.snapshot.value?.issues.find(({ id }) => id === issueId)
    if (!issue) return
    if (!visibleSeverities.value.includes(issue.severity)) {
      visibleSeverities.value = [...visibleSeverities.value, issue.severity]
    }
    openGroups.set(issue.ruleId, true)
    const ruleIssues = scopedIssues.value.filter(({ ruleId }) => ruleId === issue.ruleId)
    showRowsUpTo(
      issue.ruleId,
      ruleIssues.findIndex(({ id }) => id === issueId)
    )
    await nextTick()
    options.list.value
      ?.querySelector(`[data-issue-id="${CSS.escape(issueId)}"]`)
      ?.scrollIntoView({ block: 'center' })
  }

  // A hidden panel has no rows, so an issue focused meanwhile is revealed once the panel opens.
  watch(
    () => (options.active() ? check.focusedIssueId.value : null),
    (issueId) => {
      if (issueId) void revealIssue(issueId)
    },
    { flush: 'post' }
  )

  useCheckFollowsPanel(check, options.active, scope)

  return {
    check,
    scope,
    visibleSeverities,
    counts,
    groups,
    emptyState: empty,
    documentNote,
    loading,
    isGroupOpen,
    setGroupOpen,
    clearFilters,
    showMoreRows,
    hoverRow
  }
}

/**
 * Keeps the design check running while the panel is shown, and every page checked while it lists
 * the document; a hidden or closed panel leaves no layer highlighted.
 */
function useCheckFollowsPanel(
  check: DesignCheck,
  active: () => boolean,
  scope: Readonly<Ref<DesignCheckScope>>
) {
  watch(
    active,
    (shown) => {
      check.panelVisible.value = shown
      if (!shown) check.highlightIssue(null)
    },
    { immediate: true }
  )
  watch(
    () => active() && scope.value === 'document',
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
}
