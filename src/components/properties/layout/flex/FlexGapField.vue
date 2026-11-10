<script setup lang="ts">
import { computed, ref } from 'vue'

import { panelNumber } from '@open-pencil/core/geometry'
import { useI18n } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'
import { useLayoutControlsContext } from '@open-pencil/vue/primitives/LayoutControls'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'
import AppSelectRoot from '@/components/ui/select/AppSelectRoot.vue'
import SelectFieldTrigger from '@/components/ui/select/SelectFieldTrigger.vue'
import { panelFieldBase } from '@/theme/panel/field/base'

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
  <AppSelectRoot
    v-model:open="popupOpen"
    :model-value="auto ? 'AUTO' : 'FIXED'"
    @update:model-value="setMode"
  >
    <div ref="anchor" class="min-w-0">
      <div
        v-if="auto"
        data-test-id="layout-gap-input"
        :class="[panelFieldBase, 'flex items-center pe-0.5 text-2xs']"
      >
        <span class="flex shrink-0 items-center px-1.25 text-muted">
          <icon-lucide-align-horizontal-space-between v-if="horizontal" class="size-3.5" />
          <icon-lucide-align-vertical-space-between v-else class="size-3.5" />
        </span>
        <span class="min-w-0 flex-1 truncate text-surface">{{ panels.auto }}</span>
        <SelectFieldTrigger
          data-test-id="layout-gap-menu"
          :label="label"
          :reference="anchor ?? undefined"
        />
      </div>
      <VariableNumberField
        :round="panelNumber"
        v-else
        :data-test-id="axis === 'primary' ? 'layout-gap-input' : 'layout-cross-gap-input'"
        :aria-label="label"
        :model-value="panelNumber(ctx.node[prop])"
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
        <template v-if="allowAuto" #menu>
          <SelectFieldTrigger
            data-test-id="layout-gap-menu"
            :label="label"
            :reference="anchor ?? undefined"
          />
        </template>
      </VariableNumberField>
    </div>
    <AppSelectContent v-if="allowAuto && portalActive" align="end">
      <AppSelectItem v-for="mode in ['FIXED', 'AUTO']" :key="mode" :value="mode">
        {{ mode === 'AUTO' ? panels.auto : panelNumber(ctx.node.itemSpacing) }}
      </AppSelectItem>
    </AppSelectContent>
  </AppSelectRoot>
</template>
