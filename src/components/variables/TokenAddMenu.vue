<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import type { Component } from 'vue'
import IconHash from '~icons/lucide/hash'
import IconPalette from '~icons/lucide/palette'
import IconToggleLeft from '~icons/lucide/toggle-left'
import IconType from '~icons/lucide/type'

import type { VariableType } from '@open-pencil/scene-graph'
import { useI18n, variablesAddTestId, vTestId } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'

const emit = defineEmits<{ add: [type: VariableType] }>()

const { panels, variableTypes: text } = useI18n()
const menu = useMenuUI({ content: 'w-48', item: 'justify-start gap-2' })

const TYPES: Array<{
  type: VariableType
  icon: Component
  label: () => string
  hint: () => string
}> = [
  {
    type: 'COLOR',
    icon: IconPalette,
    label: () => text.value.color,
    hint: () => text.value.colorHint
  },
  {
    type: 'FLOAT',
    icon: IconHash,
    label: () => text.value.number,
    hint: () => text.value.numberHint
  },
  { type: 'STRING', icon: IconType, label: () => text.value.text, hint: () => text.value.textHint },
  {
    type: 'BOOLEAN',
    icon: IconToggleLeft,
    label: () => text.value.boolean,
    hint: () => text.value.booleanHint
  }
]
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <IconButton size="sm" :label="panels.createVariable" data-test-id="variables-add-variable">
        <icon-lucide-plus class="size-4" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
        <DropdownMenuItem
          v-for="item in TYPES"
          :key="item.type"
          :class="menu.item"
          v-test-id="variablesAddTestId(item.type)"
          @select="emit('add', item.type)"
        >
          <component :is="item.icon" :class="menu.icon" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span>{{ item.label() }}</span>
            <span class="truncate text-[10px] text-muted">{{ item.hint() }}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
