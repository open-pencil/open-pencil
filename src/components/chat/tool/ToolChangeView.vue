<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { ToolChange } from '@/app/ai/tools/changes/types'
import CodeViewer from '@/components/code-editor/LazyCodeViewer.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { chatToolTheme } from '@/theme/chat/tool'
import splitterTheme from '@/theme/splitter'

const { change } = defineProps<{ change: ToolChange }>()
const { ai } = useI18n()
const ui = chatToolTheme()
const splitter = tv(splitterTheme)({ direction: 'horizontal' })

const beforeURL = useObjectUrl(() => change.images?.before ?? undefined)
const afterURL = useObjectUrl(() => change.images?.after ?? undefined)
const highlightURL = useObjectUrl(() => change.images?.highlight ?? undefined)

/** Shows the changed pixels over the faded result instead of the before and after split. */
const highlight = ref(false)
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
        <span class="text-[10px] text-muted">
          {{ visible ? ai.changedPixels({ percent: changedPercent }) : ai.noVisibleChange }}
        </span>
        <IconButton
          v-if="highlightURL"
          :active="highlight"
          :aria-pressed="highlight"
          :label="ai.changeHighlight"
          data-slot="chat-tool-change-highlight"
          @click="highlight = !highlight"
        >
          <icon-lucide-highlighter class="size-3.5" />
        </IconButton>
      </div>
      <div
        :class="ui.compare()"
        :style="{ aspectRatio }"
        :data-mode="highlight ? 'highlight' : 'compare'"
        data-slot="chat-tool-change-images"
      >
        <template v-if="highlight">
          <img v-if="afterURL" :src="afterURL" :alt="ai.changeAfter" :class="ui.compareImage()" />
          <img :src="highlightURL" alt="" :class="ui.compareImage()" />
        </template>
        <SplitterGroup v-else direction="horizontal" :class="ui.compareSplit()">
          <SplitterPanel :default-size="50" :class="ui.comparePanel()">
            <img
              v-if="beforeURL"
              :src="beforeURL"
              :alt="ai.changeBefore"
              :class="ui.compareBefore()"
            />
            <span :class="ui.compareLabel({ class: 'left-1' })">{{ ai.changeBefore }}</span>
          </SplitterPanel>
          <SplitterResizeHandle :class="splitter.handle()" :aria-label="ai.changeSplit">
            <div :class="splitter.divider({ class: ui.compareDivider() })" />
          </SplitterResizeHandle>
          <SplitterPanel :default-size="50" :class="ui.comparePanel()">
            <img v-if="afterURL" :src="afterURL" :alt="ai.changeAfter" :class="ui.compareAfter()" />
            <span :class="ui.compareLabel({ class: 'right-1' })">{{ ai.changeAfter }}</span>
          </SplitterPanel>
        </SplitterGroup>
      </div>
    </template>
    <CodeViewer
      :code="change.jsx.after"
      :original="change.jsx.before"
      language="design-jsx"
      :label="ai.changeStructure"
    />
  </div>
</template>
