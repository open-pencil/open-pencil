<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import { useSelectUI } from '@/components/ui/select/select'
import Tip from '@/components/ui/overlay/Tip.vue'

import type { LayoutSizing } from '@open-pencil/scene-graph'
import type { SizeAxisFieldProps } from '@/components/properties/LayoutSection/size/types'
import type { SizeLimitProp } from '@open-pencil/vue'

type SizeSelectValue = LayoutSizing | `add-${SizeLimitProp}` | `remove-${SizeLimitProp}`

const { axis, icon, label } = defineProps<SizeAxisFieldProps>()

const ctx = useLayoutControlsContext()
const { panels } = useI18n()
const selectUI = useSelectUI({ item: 'rounded py-1.5 pr-2 pl-6 text-xs' })

const sizing = () => (axis === 'width' ? ctx.widthSizing : ctx.heightSizing)
const sizingOptions = () => (axis === 'width' ? ctx.widthSizingOptions : ctx.heightSizingOptions)
const sizingLabel = () => {
  if (sizing() === 'HUG') return panels.value.sizingHugShort
  if (sizing() === 'FILL') return panels.value.sizingFillShort
  return ''
}
const limitItems = () =>
  axis === 'width'
    ? [
        {
          prop: 'minWidth' as const,
          addLabel: panels.value.addMinWidth,
          removeLabel: panels.value.removeMinWidth
        },
        {
          prop: 'maxWidth' as const,
          addLabel: panels.value.addMaxWidth,
          removeLabel: panels.value.removeMaxWidth
        }
      ]
    : [
        {
          prop: 'minHeight' as const,
          addLabel: panels.value.addMinHeight,
          removeLabel: panels.value.removeMinHeight
        },
        {
          prop: 'maxHeight' as const,
          addLabel: panels.value.addMaxHeight,
          removeLabel: panels.value.removeMaxHeight
        }
      ]

function handleSelect(value: SizeSelectValue) {
  if (value === 'FIXED' || value === 'HUG' || value === 'FILL') {
    ctx.setAxisSizing(axis, value)
    return
  }

  const [action, prop] = value.split('-') as ['add' | 'remove', SizeLimitProp]
  if (action === 'add') ctx.addSizeLimit(prop)
  else ctx.removeSizeLimit(prop)
}
</script>

<template>
  <Tip :label="label">
    <VariableNumberField
      :icon="icon"
      :aria-label="label"
      :model-value="Math.round(ctx.node[axis])"
      :min="0"
      :node-id="ctx.node.id"
      :binding-path="axis"
      @update:model-value="ctx.updateAxisSize(axis, $event)"
      @commit="(value: number, previous: number) => ctx.commitAxisSize(axis, value, previous)"
    >
      <template #after-variable>
        <SelectRoot
          :model-value="sizing()"
          @update:model-value="handleSelect($event as SizeSelectValue)"
        >
          <SelectTrigger
            data-slot="sizing-trigger"
            :aria-label="label"
            class="flex shrink-0 cursor-pointer items-center gap-0.5 self-stretch border-none bg-transparent px-1.5 text-[10px] text-muted outline-none data-[state=open]:text-foreground"
            @pointerdown.stop
          >
            <span v-if="sizingLabel()">{{ sizingLabel() }}</span>
            <icon-lucide-chevron-down class="size-3" />
          </SelectTrigger>
          <SelectPortal>
            <SelectContent
              position="popper"
              align="start"
              :side-offset="4"
              :class="selectUI.content"
            >
              <SelectViewport class="p-0.5">
                <SelectItem
                  v-for="option in sizingOptions()"
                  :key="option.value"
                  :value="option.value"
                  :class="selectUI.item"
                >
                  <SelectItemIndicator
                    class="absolute left-1.5 inline-flex items-center justify-center"
                  >
                    <icon-lucide-check class="size-3 text-accent" />
                  </SelectItemIndicator>
                  <SelectItemText>{{ option.label }}</SelectItemText>
                </SelectItem>
                <SelectItem
                  v-for="item in limitItems()"
                  :key="item.prop"
                  :value="`${ctx.node[item.prop] == null ? 'add' : 'remove'}-${item.prop}`"
                  :class="selectUI.item"
                >
                  <SelectItemText>
                    {{ ctx.node[item.prop] == null ? item.addLabel : item.removeLabel }}
                  </SelectItemText>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </template>
    </VariableNumberField>
  </Tip>
</template>
