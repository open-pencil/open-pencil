<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'
import { useLayoutControlsContext } from '@open-pencil/vue'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import { useSelectUI } from '@/components/ui/select/select'
import Tip from '@/components/ui/overlay/Tip.vue'

import type { SizeLimitFieldProps } from '@/components/properties/LayoutSection/size/types'

const { item } = defineProps<SizeLimitFieldProps>()

const ctx = useLayoutControlsContext()
const selectUI = useSelectUI({ item: 'rounded py-1.5 px-2 text-xs' })

function handleSelect(value: string) {
  if (value === 'CURRENT') ctx.setSizeLimitToCurrent(item.prop)
  else if (value === 'REMOVE') ctx.removeSizeLimit(item.prop)
}
</script>

<template>
  <Tip :label="item.label">
    <VariableNumberField
      :icon="item.icon"
      :aria-label="item.label"
      :model-value="Math.round(ctx.node[item.prop] ?? 0)"
      :min="0"
      :node-id="ctx.node.id"
      :binding-path="item.prop"
      @update:model-value="ctx.updateSizeLimit(item.prop, $event)"
      @commit="(value: number, previous: number) => ctx.commitSizeLimit(item.prop, value, previous)"
    >
      <template #after-variable>
        <SelectRoot :model-value="'VALUE'" @update:model-value="handleSelect($event as string)">
          <SelectTrigger
            data-slot="limit-trigger"
            :aria-label="item.label"
            class="flex shrink-0 cursor-pointer items-center self-stretch border-none bg-transparent px-1 text-muted outline-none data-[state=open]:text-foreground"
            @pointerdown.stop
          >
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
                <SelectItem value="CURRENT" :class="selectUI.item">
                  <SelectItemText>{{ item.setLabel }}</SelectItemText>
                </SelectItem>
                <SelectItem value="REMOVE" :class="selectUI.item">
                  <SelectItemText>{{ item.removeLabel }}</SelectItemText>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </template>
    </VariableNumberField>
  </Tip>
</template>
