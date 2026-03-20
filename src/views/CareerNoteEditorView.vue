<script setup lang="ts">
import { provide } from 'vue'
import { useBreakpoints, useEventListener } from '@vueuse/core'
import { useHead } from '@unhead/vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { useKeyboard } from '@/composables/use-keyboard'
import { useCollab, COLLAB_KEY } from '@/composables/use-collab'
import { useEditorStore } from '@/stores/editor'
import { createTab, activeTab } from '@/stores/tabs'

import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import Toolbar from '@/components/Toolbar.vue'

import { createCareerNoteTemplate } from '@/careernote-template'

const firstTab = createTab()
const store = useEditorStore()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

useHead({ title: 'CareerNote Portfolio Editor' })
useKeyboard()

// EditorCanvas가 useCollabInjected()로 요구하는 collab provide
const collab = useCollab(firstTab.store)
provide(COLLAB_KEY, collab)

// 커리어노트 템플릿 자동 로드
createCareerNoteTemplate(firstTab.store)

useEventListener(
  document,
  'wheel',
  (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  },
  { passive: false }
)
</script>

<template>
  <div class="flex h-screen w-screen flex-col bg-background">
    <!-- CareerNote 헤더 -->
    <div class="flex h-10 shrink-0 items-center justify-between border-b border-border bg-panel px-3">
      <div class="flex items-center gap-2">
        <div class="flex size-6 items-center justify-center rounded bg-[#00A3FF] text-[10px] font-bold text-white">CN</div>
        <span class="text-sm font-semibold text-surface">Portfolio Editor</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded-md bg-[#00A3FF] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0090E0]"
          @click="store.exportSelection(2, 'PNG')"
        >
          PNG 내보내기
        </button>
      </div>
    </div>

    <!-- Desktop layout -->
    <SplitterGroup
      v-if="!isMobile"
      :key="activeTab?.id"
      direction="horizontal"
      class="flex-1 overflow-hidden"
      auto-save-id="careernote-layout"
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
        <PropertiesPanel />
      </SplitterPanel>
    </SplitterGroup>

    <!-- Mobile layout -->
    <div v-else class="flex flex-1 overflow-hidden">
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
        <Toolbar />
      </div>
    </div>
  </div>
</template>
