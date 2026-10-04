<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'
import type { SlotInstanceOption, SlotLimit } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import { panelFieldBase } from '@/theme/panel/field'

import AddInstancesPopover from './AddInstancesPopover.vue'
import SlotLimitsPopover from './SlotLimitsPopover.vue'

/** One slot property of a selected instance: its state, limits, and content actions. */
const {
  name,
  modified,
  itemCount,
  limits = [],
  options,
  preferredOnly = false
} = defineProps<{
  name: string
  /** Whether the instance owns this slot's content instead of following its component. */
  modified: boolean
  itemCount: number
  limits?: SlotLimit[]
  options: SlotInstanceOption[]
  preferredOnly?: boolean
}>()
const emit = defineEmits<{
  add: [id: string]
  reset: []
  deleteContents: []
  selectLayers: []
}>()
defineSlots<{ thumbnail?(props: { id: string }): unknown }>()
const { panels } = useI18n()
const menu = useMenuUI({ content: 'min-w-40' })
const item = menuItem({ justify: 'start' })
</script>

<template>
  <PanelFieldGroup :label="name">
    <div class="flex items-center gap-1" :data-property="`slot-${name}`">
      <div
        :class="[panelFieldBase, 'flex flex-1 items-center gap-1.5 px-2 text-xs']"
        :data-modified="modified || undefined"
      >
        <icon-lucide-square-dashed class="size-3.5 shrink-0 text-slot" />
        <span class="truncate" :class="modified ? 'text-surface' : 'text-muted'">
          {{ modified ? panels.slotModified : panels.slotDefault }}
        </span>
        <span class="ml-auto shrink-0 text-[11px] text-muted">
          {{ panels.slotItemCount(itemCount) }}
        </span>
      </div>
      <AddInstancesPopover
        :options="options"
        :preferred-only="preferredOnly"
        @add="emit('add', $event)"
      >
        <template v-if="$slots.thumbnail" #thumbnail="{ id }">
          <slot name="thumbnail" :id="id" />
        </template>
      </AddInstancesPopover>
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <IconButton :label="panels.slotActions({ name })">
            <icon-lucide-ellipsis class="size-3.5" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menu.content">
            <DropdownMenuItem :class="item" :disabled="!modified" @select="emit('reset')">
              <icon-lucide-rotate-ccw :class="menu.icon" />
              {{ panels.resetSlot }}
            </DropdownMenuItem>
            <DropdownMenuItem
              :class="item"
              :disabled="itemCount === 0"
              @select="emit('deleteContents')"
            >
              <icon-lucide-trash-2 :class="menu.icon" />
              {{ panels.deleteSlotContents }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
    <div v-if="limits.length" class="flex">
      <SlotLimitsPopover :limits="limits" @select-layers="emit('selectLayers')" />
    </div>
  </PanelFieldGroup>
</template>
