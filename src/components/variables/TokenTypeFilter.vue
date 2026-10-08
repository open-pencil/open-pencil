<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import type { VariableType } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import { VARIABLE_TYPE_ICONS, VARIABLE_TYPES } from '@/components/variables/type-icons'

/** The variable types the list shows; none checked shows every type. */
const types = defineModel<VariableType[]>({ default: () => [] })

const { variables, variableTypes: text } = useI18n()
const menu = useMenuUI({ content: 'w-44', item: 'justify-start gap-2' })

const labels = computed<Record<VariableType, string>>(() => ({
  COLOR: text.value.color,
  FLOAT: text.value.number,
  STRING: text.value.text,
  BOOLEAN: text.value.boolean
}))

function toggle(type: VariableType, on: boolean) {
  types.value = on ? [...types.value, type] : types.value.filter((candidate) => candidate !== type)
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <IconButton
        size="sm"
        :label="variables.filterByType"
        :active="types.length > 0"
        data-test-id="variables-type-filter"
      >
        <icon-lucide-list-filter class="size-4" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
        <DropdownMenuCheckboxItem
          v-for="type in VARIABLE_TYPES"
          :key="type"
          :model-value="types.includes(type)"
          :class="menu.item"
          @select.prevent
          @update:model-value="toggle(type, $event)"
        >
          <component :is="VARIABLE_TYPE_ICONS[type]" :class="menu.icon" />
          <span class="flex-1">{{ labels[type] }}</span>
          <DropdownMenuItemIndicator>
            <icon-lucide-check :class="menu.icon" />
          </DropdownMenuItemIndicator>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
