<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed, defineAsyncComponent, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { ToolChange } from '@/app/ai/tools/changes/types'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { chatToolTheme } from '@/theme/chat/tool'

const CodeViewer = defineAsyncComponent(() => import('@/components/code-editor/CodeViewer.vue'))

const { change } = defineProps<{ change: ToolChange }>()
const { ai } = useI18n()
const ui = chatToolTheme()

const beforeURL = useObjectUrl(() => change.images?.before ?? undefined)
const afterURL = useObjectUrl(() => change.images?.after ?? undefined)
const highlightURL = useObjectUrl(() => change.images?.highlight ?? undefined)

const mode = ref<'compare' | 'highlight'>('compare')
const modeOptions = computed(() => [
  { value: 'compare', label: ai.value.changeCompare },
  { value: 'highlight', label: ai.value.changeHighlight }
])
/** Share of the comparison that shows the before state, from the left edge. */
const split = ref(50)
const changedPercent = computed(() => {
  const ratio = change.images?.changedRatio ?? 0
  return ratio > 0 && ratio < 0.001 ? '<0.1' : (ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)
})
const hasImages = computed(() => Boolean(beforeURL.value || afterURL.value))
const visible = computed(() => (change.images?.changedRatio ?? 0) > 0)
const aspectRatio = computed(() =>
  change.images && change.images.height > 0
    ? `${change.images.width} / ${change.images.height}`
    : undefined
)
</script>

<template>
  <div class="space-y-2" data-slot="chat-tool-change">
    <template v-if="hasImages">
      <div class="flex items-center justify-between gap-2">
        <SegmentedControl v-model="mode" :options="modeOptions" :label="ai.changeView" size="sm" />
        <span class="text-[10px] text-muted">
          {{ visible ? ai.changedPixels({ percent: changedPercent }) : ai.noVisibleChange }}
        </span>
      </div>
      <div
        :class="ui.compare()"
        :style="{ aspectRatio }"
        :data-mode="mode"
        data-slot="chat-tool-change-images"
      >
        <img v-if="afterURL" :src="afterURL" :alt="ai.changeAfter" :class="ui.compareImage()" />
        <img
          v-if="mode === 'compare' && beforeURL"
          :src="beforeURL"
          :alt="ai.changeBefore"
          :class="ui.compareImage()"
          :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }"
        />
        <div
          v-if="mode === 'compare'"
          :class="ui.compareDivider()"
          :style="{ left: `${split}%` }"
          aria-hidden="true"
        />
        <img
          v-if="mode === 'highlight' && highlightURL"
          :src="highlightURL"
          alt=""
          :class="ui.compareImage()"
        />
        <span v-if="mode === 'compare'" :class="ui.compareLabel({ class: 'left-1' })">
          {{ ai.changeBefore }}
        </span>
        <span v-if="mode === 'compare'" :class="ui.compareLabel({ class: 'right-1' })">
          {{ ai.changeAfter }}
        </span>
      </div>
      <input
        v-if="mode === 'compare'"
        v-model.number="split"
        type="range"
        min="0"
        max="100"
        :aria-label="ai.changeSplit"
        :class="ui.compareSlider()"
      />
    </template>
    <CodeViewer
      :code="change.jsx.after"
      :original="change.jsx.before"
      language="design-jsx"
      :label="ai.changeStructure"
    />
  </div>
</template>
