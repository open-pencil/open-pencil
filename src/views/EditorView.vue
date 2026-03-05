<script setup lang="ts">
import { provide } from 'vue'
import { useBreakpoints, useEventListener, useUrlSearchParams } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { useKeyboard } from '@/composables/use-keyboard'
import { useMenu } from '@/composables/use-menu'
import { useCollab, COLLAB_KEY } from '@/composables/use-collab'
import { toast } from '@/composables/use-toast'
import { createDemoShapes } from '@/demo'
import { useEditorStore } from '@/stores/editor'
import { createTab, activeTab } from '@/stores/tabs'

import CollabPanel from '@/components/CollabPanel.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud.vue'
import MobileRibbon from '@/components/MobileRibbon.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import SafariBanner from '@/components/SafariBanner.vue'
import TabBar from '@/components/TabBar.vue'
import Toolbar from '@/components/Toolbar.vue'

const route = useRoute()
const router = useRouter()

const firstTab = createTab()
const store = useEditorStore()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')
useKeyboard()
useMenu()
const collab = useCollab(firstTab.store)
provide(COLLAB_KEY, collab)

useEventListener(
  document,
  'wheel',
  (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  },
  { passive: false }
)

const params = useUrlSearchParams('history')
const showChrome = !('no-chrome' in params)
if (!('test' in params)) {
  createDemoShapes(firstTab.store)
}

const pendingRoomId = (route.params.roomId as string) || null

function onShare() {
  const roomId = collab.shareCurrentDoc()
  router.push(`/share/${roomId}`)
  navigator.clipboard.writeText(`${window.location.origin}/share/${roomId}`)
  toast.show('Link copied to clipboard')
}

function onJoin(roomId: string) {
  collab.connect(roomId)
  router.push(`/share/${roomId}`)
}

function onDisconnect() {
  collab.disconnect()
  router.push('/')
}

function onMobileTabChange() {
  if (store.state.mobileDrawerSnap === 'closed') {
    store.state.mobileDrawerSnap = 'half'
  }
}
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
      auto-save-id="editor-layout"
    >
      <SplitterPanel :default-size="18" :min-size="10" :max-size="30" class="flex">
        <LayersPanel />
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel :default-size="64" :min-size="30" class="flex">
        <div class="relative flex min-w-0 flex-1">
          <EditorCanvas />
          <Toolbar />
        </div>
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel :default-size="18" :min-size="10" :max-size="30" class="flex flex-col">
        <div
          class="flex shrink-0 items-center justify-between border-b border-border px-1.5 py-1.5"
        >
          <CollabPanel
            :state="collab.state.value"
            :peers="collab.remotePeers.value"
            :pending-room-id="pendingRoomId"
            :following-peer="collab.followingPeer.value"
            @share="onShare"
            @join="onJoin"
            @disconnect="onDisconnect"
            @update:name="collab.setLocalName"
            @follow="collab.followPeer"
          />
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
        <MobileHud
          :collab-state="collab.state.value"
          :collab-peers="collab.remotePeers.value"
          :pending-room-id="pendingRoomId"
          :following-peer="collab.followingPeer.value"
          @share="onShare"
          @join="onJoin"
          @disconnect="onDisconnect"
          @update:collab-name="collab.setLocalName"
          @follow="collab.followPeer"
        />
        <Toolbar />
      </div>
      <MobileRibbon @tab-change="onMobileTabChange" />
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
          class="absolute left-7 top-7 z-10 flex items-center gap-2 rounded-lg border border-border bg-panel px-2 py-1 shadow-sm"
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
