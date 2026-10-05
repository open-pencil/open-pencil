<script setup lang="ts">
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { formatShortcut, provideEditor, useI18n, useViewportKind } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { appRuntimeConfig } from '@/app/runtime/config'
import { loadEditorLayout, saveEditorLayout } from '@/app/shell/layout-storage'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import { activeTab } from '@/app/tabs'
import CanvasSplitRoot from '@/components/canvas/CanvasSplitRoot.vue'
import CollabPanel from '@/components/collab-panel/CollabPanel.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import Toolbar from '@/components/Toolbar/Toolbar.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import splitterTheme from '@/theme/splitter'

import WorkspacePill from './WorkspacePill.vue'

const showChrome = appRuntimeConfig.showChrome
const store = useEditorStore()
// WorkspaceView keys this view by tab, so the tab's own store is fixed for its lifetime. Its
// editor UI stays bound to that document rather than the app-level editor, which follows the
// active tab and would move these subscriptions to the next document when this tab closes.
const tab = activeTab.value
if (tab) provideEditor(tab.store)
const { isMobile } = useViewportKind()
const initialEditorLayout = loadEditorLayout()
const horizontalSplitterStyles = tv(splitterTheme)({ direction: 'horizontal' })
/** One canvas previewing takes the whole window, in the canvas-only layout; split view keeps panels. */
const playingAlone = computed(() => store.state.play !== null && store.visiblePaneCount.value <= 1)
const { editor } = useI18n()
</script>

<template>
  <SplitterGroup
    v-if="!isMobile && showChrome && store.state.showUI && !playingAlone"
    :key="activeTab?.id"
    direction="horizontal"
    class="flex-1 overflow-hidden"
    @layout="saveEditorLayout"
  >
    <SplitterPanel
      id="layers"
      :default-size="initialEditorLayout[0]"
      :min-size="10"
      :max-size="30"
      class="flex"
    >
      <LayersPanel />
    </SplitterPanel>
    <SplitterResizeHandle
      data-test-id="left-splitter-handle"
      :class="horizontalSplitterStyles.handle()"
    >
      <div :class="horizontalSplitterStyles.divider()" />
    </SplitterResizeHandle>
    <SplitterPanel id="canvas" :default-size="initialEditorLayout[1]" :min-size="30" class="flex">
      <div class="relative flex min-w-0 flex-1">
        <CanvasSplitRoot />
        <Toolbar />
      </div>
    </SplitterPanel>
    <SplitterResizeHandle :class="horizontalSplitterStyles.handle()">
      <div :class="horizontalSplitterStyles.divider()" />
    </SplitterResizeHandle>
    <SplitterPanel
      id="properties"
      :default-size="initialEditorLayout[2]"
      :min-size="10"
      :max-size="30"
      class="flex flex-col"
    >
      <div class="flex shrink-0 items-center gap-1 border-b border-border px-1.5 py-1.5">
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

  <div
    v-else-if="showChrome"
    :key="'collapsed-' + activeTab?.id"
    class="flex flex-1 overflow-hidden"
  >
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
      <WorkspacePill
        v-if="!isMobile && playingAlone"
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

  <div v-else :key="'bare-' + activeTab?.id" class="flex flex-1 overflow-hidden">
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
    </div>
  </div>
</template>
