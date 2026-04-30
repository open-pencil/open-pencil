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
    <template v-if="ctx.node.layoutWrap === 'WRAP'">
      <ScrubInput
        data-test-id="layout-gap-input"
        class="min-w-0 flex-1"
        :icon="ctx.node.layoutMode === 'VERTICAL' ? '↕' : '↔'"
        :label="ctx.node.layoutMode === 'VERTICAL' ? panels.verticalGap : panels.horizontalGap"
        :model-value="Math.round(ctx.node.itemSpacing)"
        :min="0"
        @update:model-value="ctx.updateProp('itemSpacing', $event)"
        @commit="(v: number, p: number) => ctx.commitProp('itemSpacing', v, p)"
      />
      <ScrubInput
        data-test-id="layout-cross-gap-input"
        class="min-w-0 flex-1"
        :icon="ctx.node.layoutMode === 'VERTICAL' ? '↔' : '↕'"
        :label="ctx.node.layoutMode === 'VERTICAL' ? panels.horizontalGap : panels.verticalGap"
        :model-value="Math.round(ctx.node.counterAxisSpacing)"
        :min="0"
        @update:model-value="ctx.updateProp('counterAxisSpacing', $event)"
        @commit="(v: number, p: number) => ctx.commitProp('counterAxisSpacing', v, p)"
      />
    </template>
    <template v-else>
      <button
        v-if="ctx.gapAuto"
        data-test-id="layout-gap-input"
        class="group flex h-[26px] min-w-0 flex-1 cursor-pointer items-center rounded border border-accent/50 bg-accent/10 text-xs text-accent hover:bg-accent/15"
        @click="ctx.setGapAuto(false)"
      >
        <span
          class="flex shrink-0 items-center justify-center self-stretch px-[5px] text-accent/80"
        >
          {{ ctx.node.layoutMode === 'VERTICAL' ? '↕' : '↔' }}
        </span>
        <span class="flex-1 truncate text-left">{{ panels.auto }}</span>
      </button>
      <ScrubInput
        v-else
        data-test-id="layout-gap-input"
        class="flex-1"
        :icon="ctx.node.layoutMode === 'VERTICAL' ? '↕' : '↔'"
        :model-value="Math.round(ctx.node.itemSpacing)"
        :min="0"
        @update:model-value="ctx.updateProp('itemSpacing', $event)"
        @commit="(v: number, p: number) => ctx.commitProp('itemSpacing', v, p)"
      />
      <button
        data-test-id="layout-gap-auto-toggle"
        :title="panels.gapAuto"
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-transparent text-[10px] text-muted hover:bg-hover hover:text-surface"
        :class="ctx.gapAuto ? 'border-accent bg-accent/10 text-accent' : ''"
        @click="ctx.setGapAuto(!ctx.gapAuto)"
      >
        A
      </button>
    </template>
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
