import { useTimeoutFn } from '@vueuse/core'
import { computed, effectScope, ref, shallowRef, watch } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { isFigPagePending } from '@open-pencil/core/io/formats/fig'
import { createLinter, type LintConfig, type LintFixRequest } from '@open-pencil/core/lint'

import type { AppEditorState } from '@/app/editor/session/types'
import { appPreferences, type DesignCheckPreset } from '@/app/settings/preferences/store'

import {
  highlightForIssue,
  markersForIssues,
  mostSevereIssue,
  toDesignIssues,
  type DesignIssue
} from './issues'
import { createPageChecks, pageOf } from './pages'

/** Quiet period after an edit before the page is checked again. */
const CHECK_DELAY_MS = 180

export interface DesignCheckSnapshot {
  pageId: string
  issues: DesignIssue[]
}

function linterConfig(preset: DesignCheckPreset, disabledRules: readonly string[]): LintConfig {
  return {
    extends: preset,
    rules: Object.fromEntries(disabledRules.map((rule) => [rule, 'off' as const]))
  }
}

/**
 * Keeps the current page checked while the Check panel is open or canvas markers are on.
 *
 * Checks run once edits settle and wait out interactive property edits, so a burst of changes
 * costs one check. Nothing runs while both surfaces are off.
 */
export function createDesignCheck(editor: Editor, state: AppEditorState) {
  const scope = effectScope(true)
  const snapshot = shallowRef<DesignCheckSnapshot | null>(null)
  const panelVisible = ref(false)
  const focusedIssueId = ref<string | null>(null)

  const preferences = computed(() => appPreferences.value.designCheck)
  const enabled = computed(() => panelVisible.value || preferences.value.showOnCanvas)
  // Primitive keys keep unrelated preference changes, like toggling markers, from rebuilding rules.
  const preset = computed(() => preferences.value.preset)
  const disabledRules = computed(() => preferences.value.disabledRules.join('\n'))
  const linter = computed(() =>
    createLinter({
      config: linterConfig(preset.value, disabledRules.value ? disabledRules.value.split('\n') : [])
    })
  )

  function checkPage(pageId: string): DesignIssue[] {
    return toDesignIssues(linter.value.lintGraph(editor.graph, [pageId]).messages, pageId)
  }

  /** Set while the Lint panel lists the whole document, which needs every page checked. */
  const documentScope = ref(false)
  // Pages beyond the current one are checked for the page list and the Document scope.
  const pagesNeeded = computed(
    () => enabled.value && (preferences.value.showOnCanvas || documentScope.value)
  )
  // Stopped in dispose, so it needs no effect scope of its own.
  const pages = createPageChecks({
    graph: () => editor.graph,
    currentPageId: () => state.currentPageId,
    isPending: (pageId) => isFigPagePending(editor.graph, pageId),
    isBusy: () => editor.isInteractiveEditing(),
    check: checkPage
  })

  /** Marks the pages a graph change touches as out of date. */
  function watchGraph() {
    const graph = editor.graph
    const touch = (nodeId: string | null | undefined) => pages.invalidate(pageOf(graph, nodeId))
    return graph.onNodeEvents({
      created: (node) => touch(node.id),
      updated: (id) => touch(id),
      deleted: (_id, parentId) => touch(parentId),
      reparented: (_id, oldParentId, newParentId) => {
        touch(oldParentId)
        touch(newParentId)
      },
      reordered: (_id, parentId, _index, previousParentId) => {
        touch(parentId)
        touch(previousParentId)
      }
    })
  }
  let unwatchGraph = watchGraph()

  const delay = ref(CHECK_DELAY_MS)
  const timer = scope.run(() => useTimeoutFn(() => run(), delay, { immediate: false }))

  function cancel() {
    timer?.stop()
  }

  function run() {
    cancel()
    if (!enabled.value) return
    if (editor.isInteractiveEditing()) {
      schedule()
      return
    }
    const pageId = state.currentPageId
    snapshot.value = { pageId, issues: checkPage(pageId) }
  }

  function schedule(wait = CHECK_DELAY_MS) {
    delay.value = wait
    timer?.start()
  }

  function publishMarkers() {
    const current = snapshot.value
    const show =
      preferences.value.showOnCanvas && current !== null && current.pageId === state.currentPageId
    editor.setDesignIssueMarkers(show ? markersForIssues(current.issues) : [])
  }

  scope.run(() => {
    watch(
      enabled,
      (on) => {
        if (on) {
          run()
          return
        }
        cancel()
        snapshot.value = null
        editor.clearDesignIssues()
      },
      { immediate: true }
    )
    watch(linter, () => {
      if (enabled.value) run()
      if (pagesNeeded.value) pages.invalidateAll()
    })
    watch(pagesNeeded, (on) => (on ? pages.start() : pages.stop()), { immediate: true })
    watch(snapshot, (current) => current && pages.report(current.pageId, current.issues))
    watch(
      () => state.currentPageId,
      () => {
        focusedIssueId.value = null
        editor.setDesignIssueHighlight(null)
        if (enabled.value) run()
      }
    )
    watch(
      () => state.sceneVersion,
      () => enabled.value && schedule()
    )
    watch([snapshot, () => preferences.value.showOnCanvas], publishMarkers)
  })

  const unsubscribeGraph = editor.onEditorEvent('graph:replaced', () => {
    snapshot.value = null
    unwatchGraph()
    unwatchGraph = watchGraph()
    if (pagesNeeded.value) pages.invalidateAll()
    if (enabled.value) schedule(0)
  })

  function highlightIssue(issue: DesignIssue | null) {
    editor.setDesignIssueHighlight(issue ? highlightForIssue(issue) : null)
  }

  function issuesOn(nodeIds: readonly string[]): DesignIssue[] {
    const ids = new Set(nodeIds)
    return snapshot.value?.issues.filter((issue) => ids.has(issue.nodeId)) ?? []
  }

  /** Highlights the layer behind a hovered canvas marker; a merged marker leads with its first layer. */
  function highlightMarker(nodeIds: readonly string[] | null) {
    const issue =
      nodeIds && nodeIds.length > 0 ? mostSevereIssue(issuesOn([nodeIds[0]])) : undefined
    highlightIssue(issue ?? null)
  }

  /** Selects the layers behind a clicked marker and focuses their most severe issue. */
  function openMarker(nodeIds: readonly string[]) {
    const present = nodeIds.filter((id) => editor.graph.getNode(id))
    if (present.length === 0) return
    editor.select(present)
    focusedIssueId.value = mostSevereIssue(issuesOn(present))?.id ?? null
  }

  /** Selects the issue's layer, on its page, keeps it in view and marks the row as focused. */
  async function openIssue(issue: DesignIssue) {
    // A page switch clears the focused issue, so focus follows the switch.
    if (issue.pageId !== state.currentPageId && editor.graph.getNode(issue.pageId)) {
      await editor.switchPage(issue.pageId)
    }
    focusedIssueId.value = issue.id
    if (!editor.graph.getNode(issue.nodeId)) return
    editor.select([issue.nodeId])
    editor.revealNodes([issue.nodeId])
  }

  /** Applies fixes as one undo step and re-checks right away, so fixed rows leave at once. */
  function applyFixes(requests: readonly LintFixRequest[]) {
    if (editor.applyLintFixes(requests) > 0) run()
  }

  function dispose() {
    cancel()
    unsubscribeGraph()
    unwatchGraph()
    pages.stop()
    scope.stop()
  }

  return {
    snapshot,
    pages,
    documentScope,
    enabled,
    panelVisible,
    focusedIssueId,
    checkNow: run,
    highlightIssue,
    highlightMarker,
    openIssue,
    openMarker,
    applyFixes,
    dispose
  }
}

export type DesignCheck = ReturnType<typeof createDesignCheck>
