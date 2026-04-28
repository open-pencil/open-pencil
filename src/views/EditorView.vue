<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useEventListener, useUrlSearchParams } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { useViewportKind } from '@open-pencil/vue'
import { useKeyboard } from '@/app/shell/keyboard/use'
import { loadEditorLayout, saveEditorLayout } from '@/app/shell/layout-storage'
import { useMenu } from '@/app/shell/menu/use'
import { useCollab, COLLAB_KEY } from '@/app/collab/use'
import { connectAutomation } from '@/app/automation/bridge/server'
import { spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'
import { IS_BROWSER } from '@open-pencil/core/constants'
import { createDemoShapes } from '@/app/demo/document'
import { useEditorStore } from '@/app/editor/active-store'
import { createTab, activeTab, getActiveStore } from '@/app/tabs'

import CollabPanel from '@/components/CollabPanel/CollabPanel.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import SafariBanner from '@/components/SafariBanner.vue'
import TabBar from '@/components/TabBar.vue'
import Toolbar from '@/components/Toolbar/Toolbar.vue'

const route = useRoute()
const params = useUrlSearchParams('history')
const showChrome = !('no-chrome' in params)

const firstTab = createTab()
const store = useEditorStore()
const { isMobile } = useViewportKind()

if (route.meta.demo && !('test' in params)) {
  createDemoShapes(firstTab.store)
}

useHead({ title: route.meta.demo ? 'Demo' : undefined })
useKeyboard()
useMenu()

const collab = useCollab(getActiveStore)
provide(COLLAB_KEY, collab)

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
const initialEditorLayout = loadEditorLayout()

onMounted(async () => {
  try {
    const mcp = await spawnMCPIfNeeded()
    mcpCleanup.value = mcp?.disconnect ?? null
    const isTauri = IS_BROWSER && '__TAURI_INTERNALS__' in window
    if (import.meta.env.DEV || isTauri) {
      automationCleanup.value = connectAutomation(getActiveStore, mcp?.authToken ?? null).disconnect
    }
  } catch (e) {
    console.warn('[MCP]', e)
    if (IS_BROWSER && '__TAURI_INTERNALS__' in window) {
      const { toast } = await import('@/app/shell/ui')
      toast.warning('MCP server failed to start. Install with: npm i -g @open-pencil/mcp')
    }
  }
})

onUnmounted(() => {
  mcpCleanup.value?.()
  automationCleanup.value?.()
})
</script>

<template>
  <div data-test-id="editor-root" class="flex h-screen w-screen flex-col">
    <SafariBanner />
    <TabBar />

    <!-- Desktop layout -->
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
        class="group relative z-10 -mx-1 w-2 cursor-col-resize"
      >
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel id="canvas" :default-size="initialEditorLayout[1]" :min-size="30" class="flex">
        <div class="relative flex min-w-0 flex-1">
          <EditorCanvas />
          <Toolbar />
        </div>
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel
        id="properties"
        :default-size="initialEditorLayout[2]"
        :min-size="10"
        :max-size="30"
        class="flex flex-col"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-border px-1.5 py-1.5"
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
          <button
            data-test-id="editor-show-ui"
            class="ml-1 flex size-6 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
            title="Show UI (⌘\)"
            @click="store.state.showUI = true"
          >
            <icon-lucide-sidebar class="size-3.5" />
          </button>
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
