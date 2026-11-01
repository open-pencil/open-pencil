<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef } from 'vue'

import { resolveEditorProfile } from '@open-pencil/core'
import { formatShortcut } from '@open-pencil/vue/editor/commands'
import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'
import { useI18n } from '@open-pencil/vue/i18n'

import { provideTabEditorStore } from '@/app/editor/active-store'
import { appRuntimeConfig } from '@/app/runtime/config'
import { interfaceScaleFactor } from '@/app/shell/interface-scale'
import { loadEditorLayout, saveEditorLayout } from '@/app/shell/layout-storage'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import type { Tab } from '@/app/tabs'
import CanvasSplitRoot from '@/components/canvas/CanvasSplitRoot.vue'
import CollabPanel from '@/components/collab-panel/CollabPanel.vue'
import ActiveRoomOverlay from '@/components/collab-room/ActiveRoomOverlay.vue'
import { useRoomActions } from '@/components/collab-room/useRoomActions'
import CommentDeleteDialog from '@/components/comments/CommentDeleteDialog.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import StatusesDialog from '@/components/statuses/StatusesDialog.vue'
import EditorToolbar from '@/components/toolbar/EditorToolbar.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import VariablesDialog from '@/components/variables/VariablesDialog.vue'
import splitterTheme from '@/theme/splitter'

import WorkspacePill from './WorkspacePill.vue'

const showChrome = appRuntimeConfig.showChrome
/**
 * The document tab this workspace edits. WorkspaceView keys the workspace by tab, so the tab and
 * its store are fixed for its lifetime, and its editor UI stays bound to that document rather
 * than following the active tab to the next document when this one closes.
 */
const { tab } = defineProps<{ tab: Tab }>()
const store = tab.store
provideTabEditorStore(store)
const { isMobile } = useViewportKind()
const interfaceScale = computed(interfaceScaleFactor)
const workspace = useTemplateRef('workspace')
const { width: workspaceWidth } = useElementSize(() => {
  const element: unknown = workspace.value?.$el
  return element instanceof HTMLElement ? element : null
})
const MIN_SIDEBAR_WIDTH = 240
const MAX_SCALED_SIDEBAR_PERCENT = 35
// Retain usable fields at larger scales, while leaving at least 30% for the canvas.
const sidebarMinimum = computed(() =>
  interfaceScale.value > 1 && workspaceWidth.value > 0
    ? Math.min(
        MAX_SCALED_SIDEBAR_PERCENT,
        (MIN_SIDEBAR_WIDTH * interfaceScale.value * 100) / workspaceWidth.value
      )
    : 10
)
const sidebarMaximum = computed(() => (interfaceScale.value > 1 ? MAX_SCALED_SIDEBAR_PERCENT : 30))
// Constraints may temporarily widen either sidebar without changing the user's preference.
const preferredLayout = ref(loadEditorLayout())
const leftSize = computed(() =>
  clamp(preferredLayout.value[0], sidebarMinimum.value, sidebarMaximum.value)
)
const rightSize = computed(() =>
  clamp(preferredLayout.value[2], sidebarMinimum.value, sidebarMaximum.value)
)
let displayedLayout: number[] = []
let resizing: { sidebar: 0 | 2; startSize: number } | undefined
/** How far apart two sizes, in percent, still count as one; the splitter rounds sizes finer. */
const LAYOUT_TOLERANCE = 1e-6
function beginResize(sidebar: 0 | 2) {
  const startSize = displayedLayout[sidebar]
  if (startSize !== undefined) resizing = { sidebar, startSize }
}
function finishResize() {
  const interaction = resizing
  resizing = undefined
  if (!interaction) return
  const size = displayedLayout[interaction.sidebar]
  if (size === undefined || Math.abs(size - interaction.startSize) < LAYOUT_TOLERANCE) return
  // The opposite sidebar may be constrained; do not save its temporary width too.
  const layout: [number, number, number] = [preferredLayout.value[0], 0, preferredLayout.value[2]]
  layout[interaction.sidebar] = size
  layout[1] = 100 - layout[0] - layout[2]
  preferredLayout.value = layout
  saveEditorLayout(layout)
}
function onDragging(sidebar: 0 | 2, dragging: boolean) {
  if (dragging) beginResize(sidebar)
  else finishResize()
}
function isResizeKey(event: KeyboardEvent) {
  return ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
}
function onResizeKeyDown(sidebar: 0 | 2, event: KeyboardEvent) {
  if (isResizeKey(event)) beginResize(sidebar)
}
function onResizeKeyHandled(event: KeyboardEvent) {
  // Reka emits layout synchronously at the handle, between capture and group bubbling.
  if (isResizeKey(event)) finishResize()
}
const horizontalSplitterStyles = tv(splitterTheme)({ direction: 'horizontal' })
/**
 * A canvas whose view hides the panels takes the whole window when it is the only one shown, in the
 * canvas-only layout; split view keeps the panels for the other panes.
 */
const canvasAlone = computed(
  () => !resolveEditorProfile(store.state).panels && store.visiblePaneCount.value <= 1
)
const { editor } = useI18n()
// Until a room's document arrives there is nothing to edit, so its screen replaces the editor.
const { pending: roomPending } = useRoomActions()
</script>

<template>
  <div v-if="roomPending" :key="'room-' + tab.id" class="relative flex flex-1 overflow-hidden">
    <ActiveRoomOverlay />
  </div>

  <SplitterGroup
    v-else-if="!isMobile && showChrome && store.state.showUI && !canvasAlone"
    :key="tab.id"
    ref="workspace"
    direction="horizontal"
    class="flex-1 overflow-hidden"
    @layout="displayedLayout = $event"
    @keydown="onResizeKeyHandled"
  >
    <SplitterPanel
      id="layers"
      :default-size="leftSize"
      :min-size="sidebarMinimum"
      :max-size="sidebarMaximum"
      class="flex"
    >
      <LayersPanel />
    </SplitterPanel>
    <SplitterResizeHandle
      data-test-id="left-splitter-handle"
      :class="horizontalSplitterStyles.handle()"
      @dragging="onDragging(0, $event)"
      @keydown.capture="onResizeKeyDown(0, $event)"
    >
      <div :class="horizontalSplitterStyles.divider()" />
    </SplitterResizeHandle>
    <!-- Let the canvas take the remainder; its cached default must not outlive sidebar changes. -->
    <SplitterPanel id="canvas" :min-size="30" class="flex">
      <div class="relative flex min-w-0 flex-1">
        <CanvasSplitRoot />
        <ActiveRoomOverlay />
        <EditorToolbar />
      </div>
    </SplitterPanel>
    <SplitterResizeHandle
      data-test-id="right-splitter-handle"
      :class="horizontalSplitterStyles.handle()"
      @dragging="onDragging(2, $event)"
      @keydown.capture="onResizeKeyDown(2, $event)"
    >
      <div :class="horizontalSplitterStyles.divider()" />
    </SplitterResizeHandle>
    <SplitterPanel
      id="properties"
      :default-size="rightSize"
      :min-size="sidebarMinimum"
      :max-size="sidebarMaximum"
      class="flex flex-col"
    >
      <div
        class="interface-chrome flex shrink-0 items-center gap-1 border-b border-border px-1.5 py-1.5"
      >
        <CollabPanel class="min-w-0 flex-1" />
        <IconButton
          :label="
            editor.startPreview({
              shortcut: formatShortcut(appMenuShortcut('toggle-preview')) ?? ''
            })
          "
          data-test-id="editor-start-preview"
          @click="store.startPlay()"
        >
          <icon-lucide-play class="size-3.5" />
        </IconButton>
      </div>
      <PropertiesPanel />
    </SplitterPanel>
  </SplitterGroup>

  <div
    v-else-if="isMobile && showChrome && store.state.showUI"
    :key="'mobile-' + tab.id"
    class="flex flex-1 overflow-hidden"
  >
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
      <ActiveRoomOverlay />
      <MobileHud />
      <EditorToolbar />
    </div>
    <MobileDrawer />
  </div>

  <div v-else-if="showChrome" :key="'collapsed-' + tab.id" class="flex flex-1 overflow-hidden">
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
      <ActiveRoomOverlay />
      <WorkspacePill
        v-if="!isMobile && canvasAlone"
        mode="preview"
        :document-name="store.state.documentName"
        :shortcut="formatShortcut(appMenuShortcut('toggle-preview')) ?? ''"
        @reset="store.resetPlay()"
        @leave="store.stopPlay()"
      />
      <WorkspacePill
        v-else-if="!isMobile"
        mode="collapsed"
        :document-name="store.state.documentName"
        :shortcut="formatShortcut(appMenuShortcut('toggle-ui')) ?? ''"
        @show-ui="store.state.showUI = true"
      />
    </div>
  </div>

  <div v-else :key="'bare-' + tab.id" class="flex flex-1 overflow-hidden">
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
      <ActiveRoomOverlay />
    </div>
  </div>

  <VariablesDialog />
  <StatusesDialog />
  <CommentDeleteDialog />
</template>
