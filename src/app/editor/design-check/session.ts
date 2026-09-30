import { useTimeoutFn } from '@vueuse/core'
import { computed, effectScope, ref, shallowRef, watch } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { createLinter, type LintConfig } from '@open-pencil/core/lint'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

import type { AppEditorState } from '@/app/editor/session/types'
import { appPreferences, type DesignCheckPreset } from '@/app/settings/preferences/store'

import type { IssueFix } from './format'
import {
  highlightForIssue,
  markersForIssues,
  mostSevereIssue,
  toDesignIssues,
  type DesignIssue
} from './issues'

/** Quiet period after an edit before the page is checked again. */
const CHECK_DELAY_MS = 180
/** Margin kept between a revealed layer and the viewport edge. */
const REVEAL_MARGIN = 48

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
export function createDesignCheck(
  editor: Editor,
  state: AppEditorState,
  getViewportSize: () => { width: number; height: number }
) {
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
    const result = linter.value.lintGraph(editor.graph, [pageId])
    snapshot.value = { pageId, issues: toDesignIssues(result.messages) }
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
    watch(linter, () => enabled.value && run())
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

  /** Brings a layer into view without changing zoom when it already fits. */
  function revealNode(nodeId: string) {
    const node = editor.graph.getNode(nodeId)
    if (!node) return
    const bounds = getAxisAlignedWorldBounds(node, editor.graph)
    const { width, height } = getViewportSize()
    const zoom = state.zoom
    const fits =
      bounds.width * zoom <= width - REVEAL_MARGIN * 2 &&
      bounds.height * zoom <= height - REVEAL_MARGIN * 2
    if (!fits) {
      editor.zoomToBounds(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height)
      return
    }
    const left = bounds.x * zoom + state.panX
    const top = bounds.y * zoom + state.panY
    const right = left + bounds.width * zoom
    const bottom = top + bounds.height * zoom
    const visible =
      left >= REVEAL_MARGIN &&
      top >= REVEAL_MARGIN &&
      right <= width - REVEAL_MARGIN &&
      bottom <= height - REVEAL_MARGIN
    if (visible) return
    editor.pan(width / 2 - (left + right) / 2, height / 2 - (top + bottom) / 2)
  }

  /** Selects the issue's layer, keeps it in view and marks the row as focused. */
  function openIssue(issue: DesignIssue) {
    focusedIssueId.value = issue.id
    if (!editor.graph.getNode(issue.nodeId)) return
    editor.select([issue.nodeId])
    revealNode(issue.nodeId)
  }

  /** Binds suggested variables in one undoable step and re-checks immediately. */
  function applyFixes(fixes: readonly IssueFix[]) {
    const applicable = fixes.filter(
      (fix) => editor.graph.getNode(fix.nodeId) && editor.graph.variables.has(fix.variableId)
    )
    if (applicable.length === 0) return
    editor.undo.runBatch('Bind variables', () => {
      for (const fix of applicable) editor.bindVariable(fix.nodeId, fix.path, fix.variableId)
    })
    run()
  }

  function dispose() {
    cancel()
    unsubscribeGraph()
    scope.stop()
  }

  return {
    snapshot,
    enabled,
    panelVisible,
    focusedIssueId,
    checkNow: run,
    highlightIssue,
    highlightMarker,
    openIssue,
    openMarker,
    revealNode,
    applyFixes,
    dispose
  }
}

export type DesignCheck = ReturnType<typeof createDesignCheck>
