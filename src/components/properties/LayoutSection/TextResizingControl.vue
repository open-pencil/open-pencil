<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import Tip from '@/components/ui/Tip.vue'

import type { SceneNode } from '@open-pencil/scene-graph'

type TextResizeMode = 'AUTO_WIDTH' | 'AUTO_HEIGHT' | 'FIXED'

const ctx = useLayoutControlsContext()
const { panels } = useI18n()

function modeFor(node: SceneNode | null): TextResizeMode {
  if (node?.textAutoResize === 'WIDTH_AND_HEIGHT') return 'AUTO_WIDTH'
  if (node?.textAutoResize === 'HEIGHT' || node?.textAutoResize === 'TRUNCATE') return 'AUTO_HEIGHT'
  return 'FIXED'
}

const mode = computed<TextResizeMode>(() => modeFor(ctx.node))

const options = computed(() => [
  { value: 'AUTO_WIDTH' as const, label: panels.value.resizeAutoWidth },
  { value: 'AUTO_HEIGHT' as const, label: panels.value.resizeAutoHeight },
  { value: 'FIXED' as const, label: panels.value.resizeFixed }
])

function setMode(value: TextResizeMode) {
  const node = ctx.node
  if (!node) return
  const byMode: Record<TextResizeMode, SceneNode['textAutoResize']> = {
    AUTO_WIDTH: 'WIDTH_AND_HEIGHT',
    AUTO_HEIGHT: 'HEIGHT',
    FIXED: 'NONE'
  }
  ctx.editor.updateNodeWithUndo(node.id, { textAutoResize: byMode[value] }, 'Set text resizing')
}
</script>

<template>
  <PanelFieldGroup :label="panels.resizing" class="mb-3">
    <SegmentedControl
      :model-value="mode"
      :options="options"
      :label="panels.resizing"
      @change="setMode($event as TextResizeMode)"
    >
      <template #option="{ option }">
        <Tip :label="option.label" class="flex items-center justify-center">
          <icon-lucide-move-horizontal v-if="option.value === 'AUTO_WIDTH'" class="size-3.5" />
          <icon-lucide-wrap-text v-else-if="option.value === 'AUTO_HEIGHT'" class="size-3.5" />
          <icon-lucide-lock v-else class="size-3.5" />
        </Tip>
      </template>
    </SegmentedControl>
  </PanelFieldGroup>
</template>
