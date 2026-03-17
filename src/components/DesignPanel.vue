<script setup lang="ts">
import { computed, ref } from 'vue'

import { useEditorStore } from '@/stores/editor'

import VariablesDialog from './VariablesDialog.vue'
import KitBrowser from './kits/KitBrowser.vue'
import AppearanceSection from './properties/AppearanceSection.vue'
import EffectsSection from './properties/EffectsSection.vue'
import ExportSection from './properties/ExportSection.vue'
import FillSection from './properties/FillSection.vue'
import LayoutSection from './properties/LayoutSection.vue'
import PageSection from './properties/PageSection.vue'
import PositionSection from './properties/PositionSection.vue'
import StrokeSection from './properties/StrokeSection.vue'
import TypographySection from './properties/TypographySection.vue'
import VariablesSection from './properties/VariablesSection.vue'

const store = useEditorStore()
const variablesOpen = ref(false)
const kitBrowserOpen = ref(false)

const node = computed(() => store.selectedNode.value)
const multiCount = computed(() => store.selectedNodes.value.length)
const isComponentType = computed(() => {
  const t = node.value?.type
  return t === 'COMPONENT' || t === 'COMPONENT_SET' || t === 'INSTANCE'
})
</script>

<template>
  <!-- Multi-select summary -->
  <div
    v-if="multiCount > 1"
    data-test-id="design-panel-multi"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <div
      data-test-id="design-multi-header"
      class="flex items-center gap-1.5 border-b border-border px-3 py-2"
    >
      <span class="text-[11px] text-muted">Mixed</span>
      <span class="text-xs font-semibold">{{ multiCount }} layers</span>
    </div>
    <PositionSection />
    <AppearanceSection />
    <FillSection />
    <StrokeSection />
    <EffectsSection />
  </div>

  <!-- Single selection -->
  <div
    v-else-if="node"
    data-test-id="design-panel-single"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <div
      data-test-id="design-node-header"
      class="flex items-center gap-1.5 border-b border-border px-3 py-2"
    >
      <span class="text-[11px]" :class="isComponentType ? 'text-[#9747ff]' : 'text-muted'">{{
        node.type
      }}</span>
      <span class="text-xs font-semibold">{{ node.name }}</span>
    </div>

    <!-- Component actions -->
    <div
      v-if="node.type === 'INSTANCE'"
      class="flex flex-col gap-1 border-b border-border px-3 py-2"
    >
      <button
        data-test-id="design-go-to-component"
        class="rounded bg-[#9747ff]/10 px-2 py-1 text-left text-[11px] text-[#9747ff] hover:bg-[#9747ff]/20"
        @click="store.goToMainComponent()"
      >
        Go to Main Component
      </button>
      <button
        data-test-id="design-detach-instance"
        class="rounded px-2 py-1 text-left text-[11px] text-muted hover:bg-hover"
        @click="store.detachInstance()"
      >
        Detach Instance
      </button>
    </div>

    <PositionSection />
    <LayoutSection />
    <AppearanceSection />
    <TypographySection v-if="node.type === 'TEXT'" />
    <FillSection />
    <StrokeSection />
    <EffectsSection />

    <ExportSection />
  </div>

  <div
    v-else
    data-test-id="design-panel-empty"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PageSection />
    <VariablesSection @open-dialog="variablesOpen = true" />

    <div class="border-t border-border px-3 py-3">
      <button
        data-test-id="open-kit-browser"
        class="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-surface"
        @click="kitBrowserOpen = true"
      >
        UI Kits
      </button>
    </div>
  </div>

  <VariablesDialog v-model:open="variablesOpen" />
  <KitBrowser v-model:open="kitBrowserOpen" />
</template>
