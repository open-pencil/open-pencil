<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import IconButton from '@/components/ui/IconButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Tip from '@/components/ui/Tip.vue'

import type { LayoutMode } from '@open-pencil/scene-graph'

const ctx = useLayoutControlsContext()
const { panels } = useI18n()

const layoutModes = computed<Array<{ value: LayoutMode; label: string }>>(() => [
  { value: 'NONE', label: panels.value.freeform },
  { value: 'VERTICAL', label: panels.value.layoutVertical },
  { value: 'HORIZONTAL', label: panels.value.layoutHorizontal },
  { value: 'GRID', label: panels.value.layoutGrid }
])

function setLayoutMode(mode: string) {
  ctx.editor.setLayoutMode(ctx.node.id, mode as LayoutMode)
}
</script>

<template>
  <div>
    <label class="mb-1 block text-[11px] text-muted">{{ panels.flow }}</label>
    <div class="flex items-center gap-1.5">
      <SegmentedControl
        :model-value="ctx.node.layoutMode"
        :options="layoutModes"
        :label="panels.flow"
        :ui="{ root: 'flex min-w-0 flex-1' }"
        @change="setLayoutMode"
      >
        <template #option="{ option }">
          <Tip :label="option.label">
            <span class="flex items-center justify-center">
              <icon-lucide-move v-if="option.value === 'NONE'" class="size-3.5" />
              <icon-lucide-rows-2 v-else-if="option.value === 'VERTICAL'" class="size-3.5" />
              <icon-lucide-columns-2 v-else-if="option.value === 'HORIZONTAL'" class="size-3.5" />
              <icon-lucide-layout-grid v-else class="size-3.5" />
            </span>
          </Tip>
        </template>
      </SegmentedControl>

      <IconButton
        v-if="ctx.isFlex"
        :label="panels.layoutWrap"
        size="xs"
        :active="ctx.node.layoutWrap === 'WRAP'"
        @click="ctx.updateProp('layoutWrap', ctx.node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
      >
        <icon-lucide-wrap-text class="size-3.5" />
      </IconButton>
    </div>
  </div>
</template>
