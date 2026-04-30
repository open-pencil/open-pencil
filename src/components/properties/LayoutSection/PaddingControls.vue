<script setup lang="ts">
import ScrubInput from '@/components/ScrubInput.vue'
import { useLayoutControlsContext } from '@open-pencil/vue'

import type { PaddingProp } from '@/components/properties/LayoutSection/types'

const ctx = useLayoutControlsContext()

const paddingSides: PaddingProp[] = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
</script>

<template>
  <div v-if="!ctx.showIndividualPadding && ctx.hasUniformPadding" class="mt-1.5">
    <ScrubInput
      data-test-id="layout-uniform-padding-input"
      icon="☐"
      :model-value="Math.round(ctx.node.paddingTop)"
      :min="0"
      @update:model-value="ctx.setUniformPadding"
      @commit="ctx.commitUniformPadding"
    />
  </div>

  <div
    v-if="ctx.isGrid || (ctx.isFlex && (ctx.showIndividualPadding || !ctx.hasUniformPadding))"
    class="mt-1.5 grid grid-cols-2 gap-1.5"
  >
    <ScrubInput
      v-for="side in paddingSides"
      :key="side"
      :icon="side[7]"
      :model-value="Math.round(ctx.node[side])"
      :min="0"
      @update:model-value="ctx.updateProp(side, $event)"
      @commit="(v: number, p: number) => ctx.commitProp(side, v, p)"
    />
  </div>
</template>
