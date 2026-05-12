<script setup lang="ts">
import { ref } from 'vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import AppMenu from './AppMenu.vue'
import AssetsPanel from './AssetsPanel.vue'
import LayerTree from './LayerTree.vue'
import PagesPanel from './PagesPanel.vue'

const { panels } = useI18n()
const activePanel = ref<'layers' | 'assets'>('layers')
</script>

<template>
  <aside
    data-test-id="layers-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border bg-panel"
    style="contain: paint layout style"
  >
    <AppMenu />
    <div class="flex shrink-0 gap-1 border-b border-border px-2 py-1.5">
      <button
        data-test-id="left-panel-layers-tab"
        class="flex-1 rounded px-2 py-1 text-xs transition-colors"
        :class="
          activePanel === 'layers' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'
        "
        @click="activePanel = 'layers'"
      >
        {{ panels.layers }}
      </button>
      <button
        data-test-id="left-panel-assets-tab"
        class="flex-1 rounded px-2 py-1 text-xs transition-colors"
        :class="
          activePanel === 'assets' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'
        "
        @click="activePanel = 'assets'"
      >
        {{ panels.assets }}
      </button>
    </div>
    <AssetsPanel v-if="activePanel === 'assets'" />
    <SplitterGroup
      v-else
      direction="vertical"
      auto-save-id="layers-layout"
      class="flex-1 overflow-hidden"
    >
      <SplitterPanel
        :default-size="30"
        :min-size="10"
        :max-size="60"
        class="flex flex-col overflow-hidden"
      >
        <PagesPanel />
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -my-1 h-2 cursor-row-resize">
        <div
          class="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
        />
      </SplitterResizeHandle>
      <SplitterPanel :default-size="70" :min-size="20" class="flex flex-col overflow-hidden">
        <header
          data-test-id="layers-header"
          class="shrink-0 px-3 py-2 text-[11px] tracking-wider text-muted uppercase"
        >
          {{ panels.layers }}
        </header>
        <LayerTree data-test-id="layers-tree" />
      </SplitterPanel>
    </SplitterGroup>
  </aside>
</template>
