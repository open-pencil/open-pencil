<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { usePanelMessages } from '@open-pencil/vue/i18n'

import BoundFieldRow from '@/components/properties/binding/BoundFieldRow.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

import PropertyTypeIcon from './PropertyTypeIcon.vue'
import { usePropertyBinding, type BindableField } from './usePropertyBinding'

/** A bound field: the property it follows, with go-to and detach, in place of the value. */
const {
  field,
  label,
  compact = false
} = defineProps<{
  field: BindableField
  label?: string
  compact?: boolean
}>()
const binding = usePropertyBinding(field)
const panels = usePanelMessages()
const menu = useMenuUI({ content: 'min-w-40' })
const item = menuItem({ justify: 'start' })
const chip =
  'flex h-7 max-w-40 min-w-0 items-center gap-1.5 rounded bg-component/15 px-2 text-xs text-component'
</script>

<template>
  <DropdownMenuRoot v-if="compact && binding.available.value && binding.definition.value">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        :class="chip"
        :aria-label="`${binding.fieldLabel.value}: ${binding.definition.value.name}`"
        :data-property-bound="field"
      >
        <PropertyTypeIcon :kind="binding.definition.value.type" class="!text-component" />
        <span class="truncate">{{ binding.definition.value.name }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menu.content">
        <MenuScrollArea>
          <DropdownMenuItem :class="item" @select="binding.goToProperty()">
            <icon-lucide-crosshair :class="menu.icon" />
            {{ panels.goToComponentProperty }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="item"
            :disabled="!binding.editable.value"
            @select="binding.bind(null)"
          >
            <icon-lucide-unlink :class="menu.icon" />
            {{ panels.detachComponentProperty }}
          </DropdownMenuItem>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <BoundFieldRow
    v-else-if="binding.available.value && binding.definition.value"
    :label="label ?? binding.fieldLabel.value"
    :name="binding.definition.value.name"
    tone="component"
    :data-property-bound="field"
  >
    <template #icon>
      <PropertyTypeIcon :kind="binding.definition.value.type" class="!text-component" />
    </template>
    <template #actions>
      <IconButton :label="panels.goToComponentProperty" @click="binding.goToProperty()">
        <icon-lucide-crosshair class="size-3.5" />
      </IconButton>
      <IconButton
        :label="panels.detachComponentProperty"
        :disabled="!binding.editable.value"
        @click="binding.bind(null)"
      >
        <icon-lucide-unlink class="size-3.5" />
      </IconButton>
    </template>
  </BoundFieldRow>
</template>
