import { shallowReactive } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import { recordPreparationOutcome } from '@/app/diagnostics'
import {
  getActiveEditorStore,
  setActiveEditorStore,
  useEditorStore
} from '@/app/editor/active-store'
import { resolveFigmaClipboardImages } from '@/app/editor/clipboard/figma-images'
import { bindClipboardNotifications } from '@/app/editor/clipboard/notifications'
import { loadFont } from '@/app/editor/fonts'
import { createCanvasPaneRegistry } from '@/app/editor/panes/registry'
import { createEditorPreparationController } from '@/app/editor/preparation/controller'
import {
  createEditorPreparationEvents,
  type EditorPreparationEventName,
  type EditorPreparationEvents
} from '@/app/editor/preparation/events'
import type { EditorPreparationHandle } from '@/app/editor/preparation/types'
import {
  createEditorComputedRefs,
  createEditorStoreModules,
  defineEditorStoreAccessors
} from '@/app/editor/session/modules'
import { createInitialAppEditorState, type AppEditorState } from '@/app/editor/session/types'
import { notificationMessages } from '@/app/i18n/notifications'
import { createDeferred } from '@/app/runtime/deferred'
import { toast } from '@/app/shell/ui'
import { IS_BROWSER, IS_TAURI } from '@/constants'

export { EDITOR_TOOLS as TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core/editor'
export type { EditorToolDef as ToolDef, Tool } from '@open-pencil/core/editor'

export function createEditorStore(initialGraph?: SceneGraph) {
  const graph = initialGraph ?? new SceneGraph()

  const state = shallowReactive<AppEditorState>(createInitialAppEditorState(graph.getPages()[0].id))

  const viewportSize = { width: 0, height: 0 }
  const editor = createEditor({
    graph,
    state,
    loadFont,
    resolveFigmaClipboardImages: IS_TAURI ? resolveFigmaClipboardImages : undefined,
    skipInitialGraphSetup: !!initialGraph,
    getViewportSize: () =>
      viewportSize.width > 0 && viewportSize.height > 0
        ? viewportSize
        : {
            width: IS_BROWSER ? window.innerWidth : 1920,
            height: IS_BROWSER ? window.innerHeight : 1080
          }
  })
  const canvasReadiness = createDeferred<undefined>()
  const io = new IORegistry(BUILTIN_IO_FORMATS)
  bindClipboardNotifications(editor)

  if (initialGraph) {
    editor.subscribeToGraph()
  }

  const { selectedNodes, selectedNode, layerTree, disposeSelection } = createEditorComputedRefs(
    editor,
    state
  )
  // Mirror the document color space into app state so UI can react to it.
  const syncDocumentColorSpace = () => {
    state.documentColorSpace = editor.graph.documentColorSpace
  }
  syncDocumentColorSpace()
  const stopColorSpaceSync = editor.onEditorEvent(
    'document:color-space-changed',
    syncDocumentColorSpace
  )
  editor.onEditorEvent('graph:replaced', syncDocumentColorSpace)

  const preparationEvents = createEditorPreparationEvents()
  const preparationLifecycle = new Map<
    number,
    {
      kind: NonNullable<AppEditorState['preparation']>['kind']
      phase: NonNullable<AppEditorState['preparation']>['phase']
      startedAt: number
    }
  >()
  preparationEvents.on('preparation:started', (preparation) => {
    preparationLifecycle.set(preparation.id, {
      kind: preparation.kind,
      phase: preparation.phase,
      startedAt: preparation.startedAt
    })
  })
  preparationEvents.on('preparation:updated', (preparation) => {
    const lifecycle = preparationLifecycle.get(preparation.id)
    if (lifecycle) lifecycle.phase = preparation.phase
  })
  preparationEvents.on('preparation:finished', (result) => {
    const lifecycle = preparationLifecycle.get(result.id)
    if (!lifecycle) return
    recordPreparationOutcome({
      kind: result.kind,
      outcome: result.status,
      cancellationReason: result.status === 'cancelled' ? result.reason : null,
      failureCode: null,
      terminalPhase: lifecycle.phase,
      durationMs: performance.now() - lifecycle.startedAt
    })
    preparationLifecycle.delete(result.id)
  })
  preparationEvents.on('preparation:failed', (failure) => {
    const lifecycle = preparationLifecycle.get(failure.id)
    if (!lifecycle) return
    recordPreparationOutcome({
      kind: failure.kind,
      outcome: 'failed',
      cancellationReason: null,
      failureCode: failure.code,
      terminalPhase: lifecycle.phase,
      durationMs: performance.now() - lifecycle.startedAt
    })
    preparationLifecycle.delete(failure.id)
  })
  const preparationController = createEditorPreparationController(state, preparationEvents)
  const modules = createEditorStoreModules(editor, state, io, viewportSize, preparationController)

  // ─── Public API ───────────────────────────────────────────────
  // Spread all core Editor methods, then override getters and add app-specific.

  const panes = createCanvasPaneRegistry(state)

  function progressUnit(phase: string): 'fonts' | 'pages' | undefined {
    if (phase === 'resolving-fonts') return 'fonts'
    if (phase === 'populating-page') return 'pages'
    return undefined
  }

  async function switchPage(
    pageId: string,
    options: {
      preparation?: EditorPreparationHandle
      onProgress?: Parameters<typeof editor.switchPage>[1] extends infer Options
        ? Options extends { onProgress?: infer Progress }
          ? Progress
          : never
        : never
    } = {}
  ) {
    const page = editor.graph.getNode(pageId)
    const preparation =
      options.preparation ??
      preparationController.begin({
        kind: 'page-switch',
        phase: 'populating-page',
        subject: page?.name ?? null
      })
    const ownsPreparation = options.preparation === undefined
    let succeeded = false
    try {
      const prepared = await editor.preparePage(pageId, {
        signal: preparation.signal,
        onProgress: (progress) => {
          options.onProgress?.(progress)
          preparation.update({
            ...progress,
            unit: progressUnit(progress.phase)
          })
        }
      })
      preparation.signal.throwIfAborted()
      if (prepared) {
        editor.commitPageSwitch(prepared)
        preparation.update({ phase: 'preparing-render', detail: page?.name ?? null })
        await preparationController.waitForPresentation(preparation.id, editor.state.sceneVersion)
        preparation.signal.throwIfAborted()
      }
      succeeded = true
    } catch (error) {
      if (preparation.signal.aborted) throw error
      if (ownsPreparation) {
        const presentationTimedOut =
          error instanceof Error && error.message === 'The operation was timed out'
        preparation.fail({
          code: presentationTimedOut ? 'render-failed' : 'layout-failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: true
        })
        if (presentationTimedOut) {
          toast.error(
            notificationMessages.get().operationFailed({
              error: error instanceof Error ? error.message : String(error)
            })
          )
        }
      }
      throw error
    } finally {
      if (ownsPreparation && succeeded) preparation.complete()
    }
  }

  const store = {
    ...editor,
    state,
    preparationController,
    canvasReady: canvasReadiness.promise,
    markCanvasReady: () => canvasReadiness.resolve(undefined),
    onPreparationEvent<Event extends EditorPreparationEventName>(
      event: Event,
      handler: EditorPreparationEvents[Event]
    ) {
      return preparationEvents.on(event, handler)
    },
    panes,
    selectedNodes,
    selectedNode,
    layerTree,
    splitTree: panes.splitTree,
    activePaneId: panes.activePaneId,
    visiblePaneCount: panes.visiblePaneCount,
    getPaneRenderState: panes.getPaneRenderState,
    setActivePane: panes.setActivePane,
    switchPage,
    splitPane: panes.splitPane,
    closePane: panes.closePane,
    resizePane: panes.resizePane,
    setSplitSizes: panes.setSplitSizes,

    // App-specific overrides and additions
    ...modules,
    dispose() {
      stopColorSpaceSync()
      disposeSelection()
      modules.dispose()
    }
  }

  defineEditorStoreAccessors(store, editor)

  return store
}

export type EditorStore = ReturnType<typeof createEditorStore>

export { getActiveEditorStore, setActiveEditorStore, useEditorStore }
