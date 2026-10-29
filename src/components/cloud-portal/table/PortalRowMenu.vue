<script setup lang="ts" generic="Action extends string">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { menu } from '@/components/ui/menu/menu'

/**
 * The “…” menu at the end of a console row, holding what can be done to it besides its one
 * inline action. An item with `separated` starts a group of its own.
 */
const {
  label,
  items,
  look = 'icon',
  disabled = false
} = defineProps<{
  /** Names the menu for the row, such as “Actions for Ada”. */
  label: string
  items: readonly { action: Action; label: string; separated?: boolean }[]
  /** An icon in a table row, or an outlined button on a page of its own. */
  look?: 'icon' | 'button'
  disabled?: boolean
}>()
const emit = defineEmits<{ select: [action: Action] }>()

const menuUI = menu()
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <IconButton v-if="look === 'icon'" :label="label" :disabled="disabled || !items.length">
        <icon-lucide-ellipsis class="size-3.5" />
      </IconButton>
      <AppButton
        v-else
        size="sm"
        variant="outline"
        :aria-label="label"
        :disabled="disabled || !items.length"
      >
        <icon-lucide-ellipsis class="size-3.5" />
      </AppButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="bottom"
        align="end"
        :side-offset="4"
        :class="[menuUI.content(), 'w-56']"
      >
        <template v-for="item in items" :key="item.action">
          <DropdownMenuSeparator v-if="item.separated" :class="menuUI.separator()" />
          <DropdownMenuItem
            :class="menuUI.item({ justify: 'start' })"
            @select="emit('select', item.action)"
          >
            {{ item.label }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
