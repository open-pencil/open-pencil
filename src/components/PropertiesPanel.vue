<script setup lang="ts">
import { computed } from 'vue'

import { useEditorStore } from '../stores/editor'

import AppearanceSection from './properties/AppearanceSection.vue'
import FillSection from './properties/FillSection.vue'
import LayoutSection from './properties/LayoutSection.vue'
import PositionSection from './properties/PositionSection.vue'
import StrokeSection from './properties/StrokeSection.vue'
import TypographySection from './properties/TypographySection.vue'

const store = useEditorStore()

const node = computed(() => store.selectedNode.value)
const multiCount = computed(() => store.selectedNodes.value.length)
</script>

<template>
  <aside class="flex w-[241px] flex-col overflow-hidden border-l border-border bg-panel">
    <!-- Tabs -->
    <div class="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
      <button class="rounded px-2.5 py-1 text-xs font-semibold text-surface">Design</button>
      <button class="rounded px-2.5 py-1 text-xs text-muted">Prototype</button>
      <span class="ml-auto cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover">
        {{ Math.round(store.state.zoom * 100) }}%
      </span>
    </div>

    <!-- Multi-select summary -->
    <div v-if="multiCount > 1" class="flex-1 overflow-y-auto pb-4">
      <div class="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span class="text-[11px] text-muted">Mixed</span>
        <span class="text-xs font-semibold">{{ multiCount }} layers</span>
      </div>
      <AppearanceSection v-if="store.selectedNodes.value[0]" :node="store.selectedNodes.value[0]" />
    </div>

    <!-- Single selection -->
    <div v-else-if="node" class="flex-1 overflow-y-auto pb-4">
      <!-- Node header -->
      <div class="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span class="text-[11px] text-muted">{{ node.type }}</span>
        <span class="text-xs font-semibold">{{ node.name }}</span>
      </div>

      <PositionSection :node="node" />
      <LayoutSection :node="node" />
      <AppearanceSection :node="node" />
      <TypographySection v-if="node.type === 'TEXT'" :node="node" />
      <FillSection :node-id="node.id" :fills="node.fills" />
      <StrokeSection :node-id="node.id" :strokes="node.strokes" />

      <!-- Effects -->
      <div class="border-b border-border px-3 py-2">
        <label class="mb-1.5 block text-[11px] text-muted">Effects</label>
      </div>

      <!-- Export -->
      <div class="border-b border-border px-3 py-2">
        <label class="mb-1.5 block text-[11px] text-muted">Export</label>
      </div>
    </div>

    <div v-else class="px-3 py-4 text-xs text-muted">No selection</div>
  </aside>
</template>
