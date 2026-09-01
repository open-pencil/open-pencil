<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { formatShortcut, useI18n, useViewportKind } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { appRuntimeConfig } from '@/app/runtime/config'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import { activeTab } from '@/app/tabs'
import CanvasSplitRoot from '@/components/canvas/CanvasSplitRoot.vue'
import CollabPanel from '@/components/CollabPanel/CollabPanel.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import Tip from '@/components/ui/Tip.vue'
import Toolbar from '@/components/Toolbar/Toolbar.vue'
import { loadEditorLayout, saveEditorLayout } from '@/app/shell/layout-storage'
import splitterTheme from '@/theme/splitter'

const showChrome = appRuntimeConfig.showChrome
const store = useEditorStore()
const { editor } = useI18n()
const { isMobile } = useViewportKind()
const initialEditorLayout = loadEditorLayout()
const horizontalSplitterStyles = tv(splitterTheme)({ direction: 'horizontal' })
</script>

<template>
  <SplitterGroup
    v-if="!isMobile && showChrome && store.state.showUI"
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
      <div class="flex shrink-0 items-center justify-between border-b border-border px-1.5 py-1.5">
        <CollabPanel />
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
      <div
        v-if="!isMobile"
        class="absolute top-7 left-7 z-10 flex items-center gap-2 rounded-lg border border-border bg-panel px-2 py-1 shadow-sm"
      >
        <img src="/favicon-32.png" class="size-4" alt="OpenPencil" />
        <span data-test-id="editor-document-name" class="text-xs text-surface">{{
          store.state.documentName
        }}</span>
        <Tip
          :label="editor.showUI({ shortcut: formatShortcut(appMenuShortcut('toggle-ui')) ?? '' })"
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

  <div v-else :key="'bare-' + activeTab?.id" class="flex flex-1 overflow-hidden">
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
    </div>
  </div>
</template>
