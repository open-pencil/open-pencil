<script setup lang="ts">
import { useAIChat } from '@/composables/use-chat'
import { useEditorStore } from '@/stores/editor'

import ChatPanel from './ChatPanel.vue'
import DesignPanel from './DesignPanel.vue'

const store = useEditorStore()
const { activeTab } = useAIChat()
</script>

<template>
  <aside
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <!-- Tabs -->
    <div class="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
      <button
        class="rounded px-2.5 py-1 text-xs"
        :class="
          activeTab === 'design' ? 'font-semibold text-surface' : 'text-muted hover:text-surface'
        "
        @click="activeTab = 'design'"
      >
        Design
      </button>
      <button
        class="flex items-center gap-1 rounded px-2.5 py-1 text-xs"
        :class="activeTab === 'ai' ? 'font-semibold text-surface' : 'text-muted hover:text-surface'"
        @click="activeTab = 'ai'"
      >
        <icon-lucide-sparkles class="size-3" />
        AI
      </button>
      <span
        v-if="activeTab === 'design'"
        class="ml-auto cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover"
      >
        {{ Math.round(store.state.zoom * 100) }}%
      </span>
    </div>

    <ChatPanel v-if="activeTab === 'ai'" />
    <DesignPanel v-else />
  </aside>
</template>
