<script setup lang="ts">
import { SelectRoot, SelectTrigger } from 'reka-ui'
import { computed } from 'vue'

import type { MixedValue } from '@open-pencil/vue/controls/node-props'
import type { TypographyAxis } from '@open-pencil/vue/controls/typography'
import { useI18n } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import NumberField from '@/components/inputs/NumberField.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'

/**
 * One axis of a variable font. Optical size reads Auto while it follows the font size, as line
 * height reads Auto, and its menu switches between that and a size set by hand.
 */
const { axis, opticalSizeAuto } = defineProps<{
  axis: TypographyAxis
  opticalSizeAuto: MixedValue<boolean>
}>()
const emit = defineEmits<{
  preview: [value: number]
  commit: [value: number]
  cancel: []
  'update:opticalSizeAuto': [auto: boolean]
}>()
const { panels } = useI18n()
const { open: popupOpen, portalActive } = useRetainedPopup()
const opticalSize = computed(() => axis.tag === 'opsz')
const automatic = computed(() => opticalSize.value && opticalSizeAuto === true)
/** Axes without an icon of their own show their tag, as Position shows X and Y. */
const tagIcon = computed(() =>
  ['wght', 'wdth', 'slnt', 'ital', 'opsz'].includes(axis.tag) ? undefined : axis.tag
)
</script>

<template>
  <NumberField
    :model-value="axis.value"
    :aria-label="axis.name"
    :min="axis.min"
    :max="axis.max"
    :icon="tagIcon"
    :data-property="`font-axis-${axis.tag}`"
    @update:model-value="emit('preview', $event)"
    @commit="(value: number) => emit('commit', value)"
    @cancel="emit('cancel')"
  >
    <template v-if="!tagIcon" #icon>
      <icon-lucide-bold v-if="axis.tag === 'wght'" class="size-3" />
      <icon-lucide-move-horizontal v-else-if="axis.tag === 'wdth'" class="size-3" />
      <icon-lucide-italic v-else-if="axis.tag === 'slnt' || axis.tag === 'ital'" class="size-3" />
      <icon-lucide-type v-else class="size-3" />
    </template>
    <template v-if="automatic" #display
      ><span class="min-w-0 flex-1 truncate text-surface">{{ panels.auto }}</span></template
    >
    <template v-if="opticalSize" #suffix>
      <SelectRoot
        v-model:open="popupOpen"
        :model-value="automatic ? 'AUTO' : 'FIXED'"
        @update:model-value="emit('update:opticalSizeAuto', $event === 'AUTO')"
      >
        <SelectTrigger
          :aria-label="panels.opticalSizeMode"
          class="flex shrink-0 items-center self-stretch px-1 text-muted"
          data-property="optical-size-mode"
          @pointerdown.stop
          @keydown.stop
          ><icon-lucide-chevron-down class="size-3"
        /></SelectTrigger>
        <AppSelectContent v-if="portalActive" align="end">
          <AppSelectItem value="AUTO">{{ panels.auto }}</AppSelectItem>
          <AppSelectItem value="FIXED">{{ panels.sizingFixed }}</AppSelectItem>
        </AppSelectContent>
      </SelectRoot>
    </template>
  </NumberField>
</template>
