<script setup lang="ts">
import VariableScrubInput from '@/components/properties/VariableScrubInput.vue'
import { useLayoutControlsContext } from '@open-pencil/vue'

import type { PaddingProp } from '@/components/properties/LayoutSection/types'

const ctx = useLayoutControlsContext()

const paddingSides: Array<{ prop: PaddingProp; icon: string }> = [
  { prop: 'paddingTop', icon: 'top' },
  { prop: 'paddingRight', icon: 'right' },
  { prop: 'paddingBottom', icon: 'bottom' },
  { prop: 'paddingLeft', icon: 'left' }
]
</script>

<template>
  <div
    v-if="!ctx.showIndividualPadding && ctx.hasSymmetricPadding"
    class="mt-1.5 grid grid-cols-2 gap-1.5"
  >
    <VariableScrubInput
      data-test-id="layout-horizontal-padding-input"
      :model-value="Math.round(ctx.node.paddingLeft)"
      :min="0"
      :node-id="ctx.node.id"
      binding-path="paddingLeft"
      @update:model-value="ctx.setHorizontalPadding"
      @commit="ctx.commitHorizontalPadding"
    >
      <template #icon>
        <icon-lucide-separator-vertical class="size-3.5" />
      </template>
    </VariableScrubInput>
    <VariableScrubInput
      data-test-id="layout-vertical-padding-input"
      :model-value="Math.round(ctx.node.paddingTop)"
      :min="0"
      :node-id="ctx.node.id"
      binding-path="paddingTop"
      @update:model-value="ctx.setVerticalPadding"
      @commit="ctx.commitVerticalPadding"
    >
      <template #icon>
        <icon-lucide-separator-horizontal class="size-3.5" />
      </template>
    </VariableScrubInput>
  </div>

  <div v-else-if="ctx.isGrid || ctx.isFlex" class="mt-1.5 grid grid-cols-2 gap-1.5">
    <VariableScrubInput
      v-for="side in paddingSides"
      :key="side.prop"
      :model-value="Math.round(ctx.node[side.prop])"
      :min="0"
      :node-id="ctx.node.id"
      :binding-path="side.prop"
      @update:model-value="ctx.updateProp(side.prop, $event)"
      @commit="(v: number, p: number) => ctx.commitProp(side.prop, v, p)"
    >
      <template #icon>
        <icon-lucide-panel-top v-if="side.icon === 'top'" class="size-3.5" />
        <icon-lucide-panel-right v-else-if="side.icon === 'right'" class="size-3.5" />
        <icon-lucide-panel-bottom v-else-if="side.icon === 'bottom'" class="size-3.5" />
        <icon-lucide-panel-left v-else class="size-3.5" />
      </template>
    </VariableScrubInput>
  </div>
</template>
