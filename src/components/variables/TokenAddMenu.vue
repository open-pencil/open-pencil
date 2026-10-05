<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import type { VariableType } from '@open-pencil/scene-graph'
import { useI18n, variablesAddTestId, vTestId } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import { VARIABLE_TYPE_ICONS, VARIABLE_TYPES } from '@/components/variables/type-icons'

/** `labelled` spells out "Create variable" where the toolbar has room for it. */
const { labelled = false } = defineProps<{ labelled?: boolean }>()
const emit = defineEmits<{ add: [type: VariableType] }>()

const { panels, variableTypes: text } = useI18n()
const menu = useMenuUI({ content: 'w-48', item: 'justify-start gap-2' })

const items = computed(() => {
  const labels: Record<VariableType, { label: string; hint: string }> = {
    COLOR: { label: text.value.color, hint: text.value.colorHint },
    FLOAT: { label: text.value.number, hint: text.value.numberHint },
    STRING: { label: text.value.text, hint: text.value.textHint },
    BOOLEAN: { label: text.value.boolean, hint: text.value.booleanHint }
  }
  return VARIABLE_TYPES.map((type) => ({ type, icon: VARIABLE_TYPE_ICONS[type], ...labels[type] }))
})
</script>

<template>
  <DropdownMenuRoot>
    <!-- Reka anchors the menu to the element it mounted with, so a new button needs a new trigger. -->
    <DropdownMenuTrigger :key="String(labelled)" as-child>
      <AppButton v-if="labelled" variant="soft" size="sm" data-test-id="variables-add-variable">
        <template #leading><icon-lucide-plus class="size-3.5" /></template>
        {{ panels.createVariable }}
      </AppButton>
      <IconButton
        v-else
        size="sm"
        :label="panels.createVariable"
        data-test-id="variables-add-variable"
      >
        <icon-lucide-plus class="size-4" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
        <DropdownMenuItem
          v-for="item in items"
          :key="item.type"
          :class="menu.item"
          v-test-id="variablesAddTestId(item.type)"
          @select="emit('add', item.type)"
        >
          <component :is="item.icon" :class="menu.icon" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span>{{ item.label }}</span>
            <span class="truncate text-[10px] text-muted">{{ item.hint }}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
