<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import PaddingControls from '@/components/properties/LayoutSection/PaddingControls.vue'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import type { LayoutDirection } from '@open-pencil/core/scene-graph'

const ctx = useLayoutControlsContext()

const { panels } = useI18n()
</script>

<template>
  <div class="mt-2">
    <label class="mb-1 block text-[11px] text-muted">{{ panels.flow }}</label>
    <AppSelect
      :model-value="ctx.layoutDirection"
      :options="[
        { value: 'AUTO', label: panels.auto },
        { value: 'LTR', label: 'LTR' },
        { value: 'RTL', label: 'RTL' }
      ]"
      @update:model-value="ctx.setLayoutDirection($event as LayoutDirection)"
    />
  </div>

  <div class="mt-2 flex items-center gap-1.5">
    <ScrubInput
      data-test-id="layout-gap-input"
      class="flex-1"
      :icon="ctx.node.layoutMode === 'VERTICAL' ? '↕' : '↔'"
      :model-value="Math.round(ctx.node.itemSpacing)"
      :min="0"
      @update:model-value="ctx.updateProp('itemSpacing', $event)"
      @commit="(v: number, p: number) => ctx.commitProp('itemSpacing', v, p)"
    />
    <button
      class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-transparent text-muted hover:bg-hover hover:text-surface"
      @click="ctx.toggleIndividualPadding"
    >
      <icon-lucide-minus
        v-if="ctx.showIndividualPadding || !ctx.hasUniformPadding"
        class="size-3"
      />
      <icon-lucide-plus v-else class="size-3" />
    </button>
  </div>

  <PaddingControls />

  <div class="mt-2">
    <label class="mb-1 block text-[11px] text-muted">{{ panels.alignment }}</label>
    <div data-test-id="layout-alignment-grid" class="grid w-fit grid-cols-3 gap-0.5">
      <button
        v-for="cell in ctx.alignGrid"
        :key="`${cell.primary}-${cell.counter}`"
        class="flex size-6 cursor-pointer items-center justify-center rounded border text-[11px]"
        :class="
          ctx.node.primaryAxisAlign === cell.primary && ctx.node.counterAxisAlign === cell.counter
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-border text-muted hover:bg-hover hover:text-surface'
        "
        @click="ctx.setAlignment(cell.primary, cell.counter)"
      >
        <span class="size-1.5 rounded-full bg-current" />
      </button>
    </div>
  </div>
</template>
