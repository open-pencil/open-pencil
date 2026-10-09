<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'

import { usePanelMessages } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'

import PropertyTypeIcon from './PropertyTypeIcon.vue'
import { usePropertyBinding, type BindableField } from './usePropertyBinding'

/** Section action that links an unbound field of a component layer to a property. */
const { field } = defineProps<{ field: BindableField }>()
const binding = usePropertyBinding(field)
const panels = usePanelMessages()
const menu = useMenuUI({ content: 'min-w-44' })
const item = menuItem({ justify: 'start' })
</script>

<template>
  <DropdownMenuRoot v-if="binding.available.value && !binding.definition.value">
    <DropdownMenuTrigger as-child>
      <IconButton
        :label="panels.applyComponentProperty({ field: binding.fieldLabel.value })"
        :disabled="!binding.editable.value"
        :data-property-bind="field"
      >
        <icon-lucide-link class="size-3.5" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menu.content">
        <DropdownMenuItem :class="item" @select="binding.create()">
          <icon-lucide-plus :class="menu.icon" />
          {{ panels.createComponentProperty }}
        </DropdownMenuItem>
        <template v-if="binding.compatible.value.length">
          <DropdownMenuSeparator :class="menu.separator" />
          <DropdownMenuLabel :class="menu.label">{{ panels.properties }}</DropdownMenuLabel>
          <DropdownMenuItem
            v-for="definition in binding.compatible.value"
            :key="definition.id"
            :class="item"
            @select="binding.bind(definition.id)"
          >
            <PropertyTypeIcon :kind="definition.type" />
            {{ definition.name }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
