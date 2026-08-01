<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'
import { useDebounceFn, useElementSize, useEventListener, useUrlSearchParams } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { documentKindRules } from '@open-pencil/core/editor'
import { useViewportKind, formatShortcut, useI18n } from '@open-pencil/vue'
import { useKeyboard } from '@/app/shell/keyboard/use'
import {
  loadEditorLayout,
  loadSlidesLayout,
  loadSlidesNotesLayout,
  saveEditorLayout,
  saveSlidesLayout,
  saveSlidesNotesLayout
} from '@/app/shell/layout-storage'
import { openFileFromPath, useMenu } from '@/app/shell/menu/use'
import { useCollab, COLLAB_KEY } from '@/app/collab/use'
import { connectAutomation } from '@/app/automation/bridge/server'
import { spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'
import { isTauri } from '@/app/tauri/env'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import { createDemoShapes } from '@/app/demo/document'
import { useEditorStore } from '@/app/editor/active-store'
import { createTab, activeTab, getActiveStore, openFileInNewTab, tabCount } from '@/app/tabs'
import { takeRestorableDocument, useSessionPersistence } from '@/app/document/session/use'
import { beginPanelResize, endPanelResize } from '@/app/shell/panel-resize'
import {
  LEFT_PANEL_MAX_PERCENT,
  LEFT_PANEL_MAX_WIDTH,
  LEFT_PANEL_MIN_PERCENT,
  LEFT_PANEL_MIN_WIDTH
} from '@/constants'

import { usePresentationSession } from '@/app/editor/presentation'
import CollabPanel from '@/components/CollabPanel/CollabPanel.vue'
import CanvasStage from '@/components/canvas/CanvasStage.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import NotesPane from '@/components/slides/NotesPane.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import RenameSelectionDialog from '@/components/selection/RenameSelectionDialog.vue'
import SafariBanner from '@/components/SafariBanner.vue'
import TabBar from '@/components/TabBar.vue'
import Tip from '@/components/ui/Tip.vue'
import Toolbar from '@/components/Toolbar/Toolbar.vue'

const route = useRoute()
const params = useUrlSearchParams('history')
const showChrome = !('no-chrome' in params)

const createdInitialTab = tabCount() === 0
const firstTab = createdInitialTab ? createTab() : (activeTab.value ?? createTab())
const store = useEditorStore()
const { dialogs } = useI18n()
const { isMobile } = useViewportKind()

const isBlankStart = createdInitialTab && !route.meta.demo && !('test' in params)

if (createdInitialTab && route.meta.demo && !('test' in params)) {
  void createDemoShapes(firstTab.store)
}

// Bring back whatever was open when the tab last closed, so a reload does not silently
// discard it. Restores through the normal open path, so the document kind, fit and file
// watching all behave as if it had just been opened by hand.
if (isBlankStart) {
  void takeRestorableDocument()
    .then(async (restorable) => {
      if (!restorable) return undefined
      await openFileInNewTab(restorable.file, restorable.handle ?? undefined)
      return undefined
    })
    .catch((error: unknown) => console.warn('[session] could not restore the last document', error))
}

useSessionPersistence()

useHead({ title: route.meta.demo ? 'Demo' : undefined })
useKeyboard()
useMenu()
usePresentationSession()

const collab = useCollab(getActiveStore)
provide(COLLAB_KEY, collab)

const isPresenting = computed(() => store.state.presenting)

// A divider drag continues even if the pointer leaves the handle, so the release is
// watched on the window rather than on the handle itself.
useEventListener(window, 'pointerup', endPanelResize)
useEventListener(window, 'pointercancel', endPanelResize)

useEventListener(
  document,
  'wheel',
  (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  },
  { passive: false }
)

const automationCleanup = ref<(() => void) | null>(null)
const mcpCleanup = ref<(() => void) | null>(null)
const fileAssociationCleanup = ref<(() => void) | null>(null)

const isSlidesView = computed(
  () => documentKindRules(store.state.documentKind).leftRail === 'filmstrip'
)
/** Presenter notes only exist for slides documents; design canvases stay a single host. */
const showNotesPane = isSlidesView
/** Design vs slides layouts are stored separately; slides defaults right panel to min (10). */
const panelLayout = computed(() => (isSlidesView.value ? loadSlidesLayout() : loadEditorLayout()))
const splitterKey = computed(() => `${activeTab.value?.id ?? 'tab'}-${store.state.documentKind}`)

/**
 * The slides rail is capped in pixels, not as a share of the window: it holds fixed-width
 * thumbnails, so on a wide display a percentage cap just leaves it fat and empty. The
 * splitter takes percentages, so convert against its live width.
 */
const splitterGroup = useTemplateRef<{ $el?: HTMLElement } | HTMLElement>('splitterGroup')
const splitterEl = computed<HTMLElement | null>(() => {
  const value = splitterGroup.value
  if (!value) return null
  return value instanceof HTMLElement ? value : (value.$el ?? null)
})
const { width: splitterWidth } = useElementSize(splitterEl)
/**
 * Both bounds are pixel-based, converted against the splitter's live width.
 *
 * Leaving the minimum as a share of the window meant that beyond about 3100px it overtook
 * the 310px cap and won, so the rail grew to 344px and then 512px — the very thing the cap
 * exists to prevent. Scaling both keeps them ordered at any width.
 */
const asPercentOfSplitter = (px: number, fallback: number) =>
  splitterWidth.value > 0 ? (px / splitterWidth.value) * 100 : fallback

const layersMinSize = computed(() =>
  Math.min(
    asPercentOfSplitter(LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MIN_PERCENT),
    LEFT_PANEL_MIN_PERCENT
  )
)
const layersMaxSize = computed(() =>
  Math.min(
    asPercentOfSplitter(LEFT_PANEL_MAX_WIDTH, LEFT_PANEL_MAX_PERCENT),
    LEFT_PANEL_MAX_PERCENT
  )
)

/**
 * The remembered width has to obey the same bounds as the panel.
 *
 * A stored 22% is wider than a 310px cap on any window past about 1410px, and a default
 * outside its own min/max is an invalid constraint: the splitter rejects the layout and
 * renormalises it, which is what "Invalid layout total size" was reporting.
 */
const layersDefaultSize = computed(() =>
  Math.min(Math.max(panelLayout.value[0] ?? 0, layersMinSize.value), layersMaxSize.value)
)
const propertiesDefaultSize = computed(() => panelLayout.value[2] ?? 0)
/**
 * The three defaults must total 100, so the canvas absorbs whatever clamping the rail
 * needed. Leaving the stored values untouched made them sum to 99.5 once the rail was
 * capped, and the splitter discards a layout that does not add up.
 */
const canvasDefaultSize = computed(() =>
  Math.max(0, 100 - layersDefaultSize.value - propertiesDefaultSize.value)
)

/**
 * Presenter notes sit in a vertical splitter inside the canvas panel. The pane's height and
 * collapsed state persist under their own key (see layout-storage) so a resize survives a
 * reload; the outer splitter is keyed by tab + kind, so the vertical group remounts with it
 * and `defaultSize` re-applies the remembered geometry.
 */
const notesPanel = useTemplateRef('notesPanel')
const notesLayout = loadSlidesNotesLayout()
const notesCollapsed = ref(notesLayout.collapsed)
const notesSize = ref(notesLayout.size)
const notesDefaultSize = computed(() => (notesCollapsed.value ? 0 : notesSize.value))
const canvasMainDefaultSize = computed(() => 100 - notesDefaultSize.value)

function onNotesSplitterLayout(layout: number[]) {
  const notes = layout[1] ?? 0
  if (notes > 0) notesSize.value = notes
  saveSlidesNotesLayout({ size: notes > 0 ? notes : notesSize.value, collapsed: notes === 0 })
}

/** Restore the notes pane at its last size after it was collapsed to its handle. */
function restoreNotesPane() {
  notesPanel.value?.resize(notesSize.value)
}

if (import.meta.env.DEV) {
  /**
   * Panel defaults must total 100 or the splitter discards the layout and renormalises it,
   * reporting only "Invalid layout total size" with no indication of which group or which
   * numbers. Assert on our own values so a drift names itself.
   */
  watchEffect(() => {
    const sizes = {
      layers: layersDefaultSize.value,
      canvas: canvasDefaultSize.value,
      properties: propertiesDefaultSize.value
    }
    const total = sizes.layers + sizes.canvas + sizes.properties
    if (Math.abs(total - 100) > 0.01) {
      console.warn('[layout] panel defaults do not total 100', { ...sizes, total })
    }
  })
}

/**
 * Splitter drags emit continuously; localStorage writes are synchronous, so persisting on
 * every emission stutters the drag. Only the resting position needs to survive a reload.
 */
const onSplitterLayout = useDebounceFn((layout: number[]) => {
  if (isSlidesView.value) saveSlidesLayout(layout)
  else saveEditorLayout(layout)
}, 200)

// Remounting the splitter for decks (narrow right panel) changes canvas size — re-fit
watch(
  () => store.state.documentKind,
  async (kind) => {
    if (!documentKindRules(kind).autoFitOnResize) return
    await nextTick()
    await store.fitCurrentPageToViewport()
  }
)

type PendingOpenFile = {
  path: string
}

async function openPendingAssociatedFiles() {
  const { invoke } = await import('@tauri-apps/api/core')
  const files = await invoke<PendingOpenFile[]>('take_pending_open')
  for (const file of files) {
    await openFileFromPath(file.path)
  }
}

async function bindAssociatedFileOpen() {
  if (!isTauri()) return
  const { listen } = await import('@tauri-apps/api/event')
  fileAssociationCleanup.value = await listen('open-associated-files', () => {
    void openPendingAssociatedFiles().catch((e) => console.error('[Open With]', e))
  })
  await openPendingAssociatedFiles()
}

onMounted(async () => {
  try {
    const mcp = await spawnMCPIfNeeded()
    mcpCleanup.value = mcp?.disconnect ?? null
    const tauri = isTauri()
    if (import.meta.env.DEV || tauri) {
      automationCleanup.value = connectAutomation(getActiveStore, mcp?.authToken ?? null).disconnect
    }
  } catch (e) {
    console.warn('[MCP]', e)
  }

  try {
    await bindAssociatedFileOpen()
  } catch (e) {
    console.error('[Open With]', e)
  }
})

onUnmounted(() => {
  mcpCleanup.value?.()
  automationCleanup.value?.()
  fileAssociationCleanup.value?.()
})
</script>

<template>
  <div data-test-id="editor-root" class="flex h-screen w-screen flex-col">
    <SafariBanner />
    <RenameSelectionDialog />
    <TabBar />

    <!-- Desktop layout -->
    <SplitterGroup
      v-if="!isMobile && showChrome && store.state.showUI"
      ref="splitterGroup"
      :key="splitterKey"
      direction="horizontal"
      class="flex-1 overflow-hidden"
      @layout="onSplitterLayout"
    >
      <SplitterPanel
        id="layers"
        :default-size="layersDefaultSize"
        :min-size="layersMinSize"
        :max-size="layersMaxSize"
        class="flex"
      >
        <LayersPanel />
      </SplitterPanel>
      <SplitterResizeHandle
        data-test-id="left-splitter-handle"
        class="group relative z-10 -mx-1 w-2 cursor-col-resize"
        @pointerdown="beginPanelResize"
      >
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel id="canvas" :default-size="canvasDefaultSize" :min-size="30" class="flex">
        <!--
          The presenter notes pane nests a vertical splitter inside the canvas panel. For
          design documents the canvas panel is a plain flex host. The canvas host itself is
          never behind a `v-if` here: only the splitter wrapper swaps, and it is keyed by
          document kind like the outer splitter, so the CanvasKit surfaces are not remounted
          on presentation enter/exit.
        -->
        <SplitterGroup
          v-if="showNotesPane"
          direction="vertical"
          class="flex h-full min-h-0 min-w-0 flex-col"
          @layout="onNotesSplitterLayout"
        >
          <SplitterPanel
            id="canvas-main"
            :default-size="canvasMainDefaultSize"
            :min-size="40"
            class="flex"
          >
            <CanvasStage :presenting="isPresenting" />
          </SplitterPanel>
          <SplitterResizeHandle
            class="group relative z-10 flex h-2 w-full shrink-0 cursor-row-resize items-center justify-center"
            @pointerdown="beginPanelResize"
          >
            <div
              class="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
            />
            <button
              v-if="notesCollapsed"
              type="button"
              data-test-id="notes-show"
              class="relative z-10 flex h-5 cursor-pointer items-center gap-1 rounded-md border border-border bg-panel px-2 text-[11px] font-medium text-surface shadow-sm hover:bg-hover"
              @click.stop="restoreNotesPane"
            >
              <icon-lucide-notebook-pen class="size-3.5" />
              {{ dialogs.showPresenterNotes }}
            </button>
          </SplitterResizeHandle>
          <SplitterPanel
            id="notes"
            ref="notesPanel"
            :default-size="notesDefaultSize"
            :min-size="10"
            :max-size="50"
            :collapsible="true"
            :collapsed-size="0"
            class="flex"
            @collapse="notesCollapsed = true"
            @expand="notesCollapsed = false"
          >
            <NotesPane />
          </SplitterPanel>
        </SplitterGroup>
        <div v-else class="relative flex min-h-0 min-w-0 flex-1">
          <CanvasStage :presenting="isPresenting" />
        </div>
      </SplitterPanel>
      <SplitterResizeHandle
        class="group relative z-10 -mx-1 w-2 cursor-col-resize"
        @pointerdown="beginPanelResize"
      >
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel
        id="properties"
        :default-size="propertiesDefaultSize"
        :min-size="10"
        :max-size="30"
        class="flex flex-col"
      >
        <div
          class="relative z-20 flex shrink-0 items-center justify-between border-b border-border px-1.5 py-1.5"
        >
          <CollabPanel />
        </div>
        <PropertiesPanel />
      </SplitterPanel>
    </SplitterGroup>

    <!-- Mobile layout -->
    <div
      v-else-if="isMobile && showChrome && store.state.showUI"
      :key="'mobile-' + activeTab?.id"
      class="flex flex-1 overflow-hidden"
    >
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
        <MobileHud />
        <Toolbar />
      </div>
      <MobileDrawer />
    </div>

    <!-- Collapsed UI (showUI=false) -->
    <div
      v-else-if="showChrome"
      :key="'collapsed-' + activeTab?.id"
      class="flex flex-1 overflow-hidden"
    >
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
        <div
          v-if="!isMobile"
          class="absolute top-7 left-7 z-10 flex items-center gap-2 rounded-lg border border-border bg-panel px-2 py-1 shadow-sm"
        >
          <img src="/favicon-32.png" class="size-4" alt="OpenPencil" />
          <span data-test-id="editor-document-name" class="text-xs text-surface">{{
            store.state.documentName
          }}</span>
          <Tip
            :label="
              dialogs.showUI({ shortcut: formatShortcut(appMenuShortcut('toggle-ui')) ?? '' })
            "
          >
            <button
              data-test-id="editor-show-ui"
              class="ml-1 flex size-6 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="store.state.showUI = true"
            >
              <icon-lucide-sidebar class="size-3.5" />
            </button>
          </Tip>
        </div>
      </div>
    </div>

    <!-- Bare canvas (no chrome, e.g. ?no-chrome) -->
    <div v-else :key="'bare-' + activeTab?.id" class="flex flex-1 overflow-hidden">
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
      </div>
    </div>
  </div>
</template>
