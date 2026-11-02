<script setup lang="ts">
import { computed } from 'vue'

import {
  SHAPE_WITH_TEXT_GROUPS,
  isShapeWithTextType,
  type ShapeWithTextType
} from '@open-pencil/scene-graph/shape-with-text'
import { useCommonMessages, useShapeMessages } from '@open-pencil/vue/i18n'

import { SHAPE_KIND_ICONS } from '@/components/icons/shapes'
import AppPicker from '@/components/ui/select/AppPicker.vue'
import type { AppPickerItem } from '@/components/ui/select/AppPicker.vue'

import { useShapeKindLabels } from './labels'

/**
 * FigJam's shape kinds as a searchable grid of their outlines, Basic then Flowchart, as its
 * Shapes panel offers them.
 */
const {
  heading,
  selected,
  tooltip,
  side = 'top',
  align = 'center'
} = defineProps<{
  heading: string
  selected?: ShapeWithTextType
  tooltip?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
}>()
const emit = defineEmits<{ select: [kind: ShapeWithTextType] }>()
const open = defineModel<boolean>('open', { default: false })
defineSlots<{ trigger(): unknown }>()

const shapes = useShapeMessages()
const common = useCommonMessages()
const label = useShapeKindLabels()

const items = computed<AppPickerItem[]>(() =>
  (['basic', 'flowchart'] as const).flatMap((group) =>
    SHAPE_WITH_TEXT_GROUPS[group].map((kind) => ({
      value: kind,
      label: label.value(kind),
      group: shapes.value[group]
    }))
  )
)

function pick(value: string) {
  if (isShapeWithTextType(value)) emit('select', value)
}
</script>

<template>
  <AppPicker
    v-model:open="open"
    layout="grid"
    :heading="heading"
    :items="items"
    :selected="selected"
    :tooltip="tooltip"
    :side="side"
    :align="align"
    :search-placeholder="shapes.search"
    :empty-label="shapes.noResults"
    :close-label="common.close"
    @select="pick"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>
    <template #leading="{ item }">
      <component
        :is="SHAPE_KIND_ICONS[item.value]"
        v-if="isShapeWithTextType(item.value)"
        class="size-5"
      />
    </template>
    <template #footer="{ highlighted }">
      <p class="flex h-5 items-center truncate px-1 text-[11px] text-muted">
        <span class="truncate" :class="highlighted && 'text-surface'">
          {{ highlighted?.label ?? label(selected ?? 'SQUARE') }}
        </span>
      </p>
    </template>
  </AppPicker>
</template>
