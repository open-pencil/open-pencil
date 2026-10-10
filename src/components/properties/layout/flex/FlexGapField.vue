<script setup lang="ts">
import { SelectRoot, SelectTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import { useI18n, useLayoutControlsContext, useRetainedPopup } from '@open-pencil/vue'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'

const { axis = 'primary' } = defineProps<{ axis?: 'primary' | 'counter' }>()
const ctx = useLayoutControlsContext()
const { open: popupOpen, portalActive } = useRetainedPopup()
const { panels } = useI18n()
const anchor = ref<HTMLElement | null>(null)
const prop = computed(() => (axis === 'primary' ? 'itemSpacing' : 'counterAxisSpacing'))
const horizontal = computed(() => (ctx.node.layoutMode === 'HORIZONTAL') === (axis === 'primary'))
const label = computed(() =>
  horizontal.value ? panels.value.horizontalGap : panels.value.verticalGap
)
const auto = computed(() => axis === 'primary' && ctx.gapAuto && ctx.node.layoutWrap !== 'WRAP')
const allowAuto = computed(() => axis === 'primary' && ctx.node.layoutWrap !== 'WRAP')
function setMode(value: string) {
  ctx.setGapAuto(value === 'AUTO')
}
</script>

<template>
  <SelectRoot
    v-model:open="popupOpen"
    :model-value="auto ? 'AUTO' : 'FIXED'"
    @update:model-value="setMode"
  >
    <div ref="anchor" class="min-w-0">
      <div
        v-if="auto"
        data-test-id="layout-gap-input"
        class="flex h-[26px] items-center rounded border border-border bg-input focus-within:border-panel-focus"
      >
        <span class="px-[5px] text-muted">
          <icon-lucide-align-horizontal-space-between v-if="horizontal" class="size-3.5" />
          <icon-lucide-align-vertical-space-between v-else class="size-3.5" />
        </span>
        <span class="min-w-0 flex-1 truncate text-xs text-surface">{{ panels.auto }}</span>
        <SelectTrigger
          data-test-id="layout-gap-menu"
          :aria-label="label"
          :reference="anchor ?? undefined"
          class="flex shrink-0 items-center self-stretch px-1 text-muted"
          @pointerdown.stop
        >
          <icon-lucide-chevron-down class="size-3" />
        </SelectTrigger>
      </div>
      <VariableNumberField
        v-else
        :data-test-id="axis === 'primary' ? 'layout-gap-input' : 'layout-cross-gap-input'"
        :aria-label="label"
        :model-value="Math.round(ctx.node[prop])"
        :min="0"
        :node-id="ctx.node.id"
        :binding-path="prop"
        @update:model-value="ctx.updateProp(prop, $event)"
        @commit="(value, previous) => ctx.commitProp(prop, value, previous)"
        @cancel="ctx.cancelPreview"
      >
        <template #icon>
          <icon-lucide-align-horizontal-space-between v-if="horizontal" class="size-3.5" />
          <icon-lucide-align-vertical-space-between v-else class="size-3.5" />
        </template>
        <template v-if="allowAuto" #after-variable>
          <SelectTrigger
            data-test-id="layout-gap-menu"
            :aria-label="label"
            :reference="anchor ?? undefined"
            class="flex shrink-0 items-center self-stretch px-1 text-muted"
            @pointerdown.stop
          >
            <icon-lucide-chevron-down class="size-3" />
          </SelectTrigger>
        </template>
      </VariableNumberField>
    </div>
    <AppSelectContent v-if="allowAuto && portalActive" align="end">
      <AppSelectItem v-for="mode in ['FIXED', 'AUTO']" :key="mode" :value="mode">
        {{ mode === 'AUTO' ? panels.auto : Math.round(ctx.node.itemSpacing) }}
      </AppSelectItem>
    </AppSelectContent>
  </SelectRoot>
</template>
