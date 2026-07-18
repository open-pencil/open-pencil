<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import SizeAxisField from '@/components/properties/LayoutSection/size/SizeAxisField.vue'
import SizeLimitField from '@/components/properties/LayoutSection/size/SizeLimitField.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'

import type { SizeLimitItem } from '@/components/properties/LayoutSection/size/types'

const ctx = useLayoutControlsContext()
const { panels } = useI18n()

const sizeLimits = computed<SizeLimitItem[]>(() => [
  {
    prop: 'minWidth',
    icon: panels.value.minWidthShort,
    label: panels.value.minWidthShort,
    setLabel: panels.value.setToCurrentWidth,
    removeLabel: panels.value.removeMinWidth
  },
  {
    prop: 'maxWidth',
    icon: panels.value.maxWidthShort,
    label: panels.value.maxWidthShort,
    setLabel: panels.value.setToCurrentWidth,
    removeLabel: panels.value.removeMaxWidth
  },
  {
    prop: 'minHeight',
    icon: panels.value.minHeightShort,
    label: panels.value.minHeightShort,
    setLabel: panels.value.setToCurrentHeight,
    removeLabel: panels.value.removeMinHeight
  },
  {
    prop: 'maxHeight',
    icon: panels.value.maxHeightShort,
    label: panels.value.maxHeightShort,
    setLabel: panels.value.setToCurrentHeight,
    removeLabel: panels.value.removeMaxHeight
  }
])

const visibleSizeLimits = computed(() =>
  sizeLimits.value.filter((item) => ctx.node[item.prop] != null)
)
</script>

<template>
  <PanelGrid columns="two">
    <SizeAxisField axis="width" icon="W" :label="panels.width" />
    <SizeAxisField axis="height" icon="H" :label="panels.height" />
  </PanelGrid>

  <PanelGrid v-if="visibleSizeLimits.length" columns="two" class="mt-1.5">
    <SizeLimitField v-for="item in visibleSizeLimits" :key="item.prop" :item="item" />
  </PanelGrid>
</template>
