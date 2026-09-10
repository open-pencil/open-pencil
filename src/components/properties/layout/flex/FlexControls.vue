<script setup lang="ts">
import { computed } from 'vue'

import type { LayoutDirection } from '@open-pencil/scene-graph'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import AppSelect from '@/components/ui/select/AppSelect.vue'

import LayoutAlignmentControl from '../alignment/LayoutAlignmentControl.vue'
import ClipContentControl from '../ClipContentControl.vue'
import PaddingControls from '../padding/PaddingControls.vue'
import FlexGapField from './FlexGapField.vue'

const ctx = useLayoutControlsContext()
const { panels } = useI18n()
const alignmentCells = computed(() => {
  const horizontal = [
    panels.value.alignLeft,
    panels.value.alignCenterHorizontally,
    panels.value.alignRight
  ]
  const vertical = [
    panels.value.alignTop,
    panels.value.alignCenterVertically,
    panels.value.alignBottom
  ]
  return ctx.alignGrid.map((cell, index) => ({
    ...cell,
    label: `${vertical[Math.floor(index / 3)]}, ${horizontal[index % 3]}`,
    active:
      ctx.node.primaryAxisAlign === (ctx.gapAuto ? 'SPACE_BETWEEN' : cell.primary) &&
      ctx.node.counterAxisAlign === cell.counter
  }))
})
</script>

<template>
  <div class="mt-2">
    <label class="mb-1 block text-[11px] text-muted">{{ panels.direction }}</label>
    <AppSelect
      :label="panels.direction"
      :model-value="ctx.layoutDirection"
      :options="[
        { value: 'AUTO', label: panels.auto },
        { value: 'LTR', label: 'LTR' },
        { value: 'RTL', label: 'RTL' }
      ]"
      @update:model-value="ctx.setLayoutDirection($event as LayoutDirection)"
    />
  </div>
  <div class="mt-2 grid grid-cols-[78px_minmax(0,1fr)] items-start gap-3">
    <LayoutAlignmentControl
      data-test-id="layout-alignment-grid"
      :label="panels.alignment"
      :cells="alignmentCells"
      @select="
        (primary, counter) => ctx.setAlignment(ctx.gapAuto ? 'SPACE_BETWEEN' : primary, counter)
      "
    />
    <div class="flex min-w-0 flex-col gap-1.5">
      <FlexGapField />
      <FlexGapField v-if="ctx.node.layoutWrap === 'WRAP'" axis="counter" />
    </div>
  </div>
  <PaddingControls />
  <ClipContentControl />
</template>
