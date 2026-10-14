<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import IconChevronRight from '~icons/lucide/chevron-right'

import type { MenuEntry } from '@open-pencil/vue'

import {
  hasMenuSubItems,
  isMenuCheckbox,
  isMenuSeparator,
  menuChecked,
  menuDisabled,
  menuLabel,
  menuShortcut,
  menuSubItems,
  runMenuAction,
  updateMenuChecked
} from '@/app/shell/menu/entry'
import AppShortcutText from '@/components/ui/menu/AppShortcutText.vue'
import { useMenuUI } from '@/components/ui/menu/menu'

/** One level of the main menu; each submenu renders its entries with this component again. */
const { entries } = defineProps<{ entries: MenuEntry[] }>()

const menuCls = useMenuUI()
const subMenuCls = useMenuUI({ content: 'min-w-52' })
</script>

<template>
  <template v-for="(entry, i) in entries" :key="i">
    <DropdownMenuSeparator v-if="isMenuSeparator(entry)" :class="menuCls.separator" />
    <DropdownMenuSub v-else-if="hasMenuSubItems(entry)">
      <DropdownMenuSubTrigger :class="menuCls.item" :disabled="menuDisabled(entry)">
        <span class="flex-1">{{ menuLabel(entry) }}</span>
        <IconChevronRight class="size-3 text-muted" />
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent :side-offset="4" :class="subMenuCls.content">
          <MainMenuEntries :entries="menuSubItems(entry)" />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
    <DropdownMenuCheckboxItem
      v-else-if="isMenuCheckbox(entry)"
      :model-value="menuChecked(entry)"
      :class="menuCls.item"
      @update:model-value="updateMenuChecked(entry, $event as boolean)"
    >
      <span class="flex-1">{{ menuLabel(entry) }}</span>
      <DropdownMenuItemIndicator class="text-surface">
        <icon-lucide-check class="size-3.5" />
      </DropdownMenuItemIndicator>
    </DropdownMenuCheckboxItem>
    <DropdownMenuItem
      v-else
      :class="menuCls.item"
      :disabled="menuDisabled(entry)"
      @select="runMenuAction(entry)"
    >
      <span class="flex-1">{{ menuLabel(entry) }}</span>
      <AppShortcutText v-if="menuShortcut(entry)">{{ menuShortcut(entry) }}</AppShortcutText>
    </DropdownMenuItem>
  </template>
</template>
