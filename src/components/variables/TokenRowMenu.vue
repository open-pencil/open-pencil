<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import { useMenuUI } from '@/components/ui/menu/menu'

/**
 * Right-click actions for the selected tokens. The list selects the row under the pointer before
 * the menu opens, so every action applies to what is highlighted.
 */
const { groups, single } = defineProps<{
  /** Groups the tokens can move into, as their paths. */
  groups: string[]
  /** One token is selected, so it can be renamed in place. */
  single: boolean
}>()
const emit = defineEmits<{
  rename: []
  duplicate: []
  moveToGroup: [group: string]
  newGroup: []
  remove: []
}>()

const { variables, pages } = useI18n()
const menu = useMenuUI({ content: 'w-52', item: 'justify-start gap-2' })
const dangerItem = useMenuUI({ item: 'justify-start gap-2 text-error' }).item
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent :class="menu.content" data-test-id="variables-row-menu">
        <ContextMenuItem v-if="single" :class="menu.item" @select="emit('rename')">
          <icon-lucide-pencil :class="menu.icon" />
          {{ pages.rename }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="menu.item"
          data-test-id="variables-duplicate"
          @select="emit('duplicate')"
        >
          <icon-lucide-copy :class="menu.icon" />
          {{ variables.duplicate }}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger :class="menu.subTrigger" data-test-id="variables-move-to-group">
            <icon-lucide-folder-input :class="menu.icon" />
            <span class="flex-1">{{ variables.moveToGroup }}</span>
            <icon-lucide-chevron-right :class="menu.icon" />
          </ContextMenuSubTrigger>
          <ContextMenuPortal>
            <ContextMenuSubContent :class="menu.content">
              <ContextMenuItem :class="menu.item" @select="emit('moveToGroup', '')">
                {{ variables.noGroup }}
              </ContextMenuItem>
              <ContextMenuItem
                v-for="group in groups"
                :key="group"
                :class="menu.item"
                @select="emit('moveToGroup', group)"
              >
                {{ group }}
              </ContextMenuItem>
              <ContextMenuSeparator :class="menu.separator" />
              <ContextMenuItem
                :class="menu.item"
                data-test-id="variables-new-group"
                @select="emit('newGroup')"
              >
                <icon-lucide-folder-plus :class="menu.icon" />
                {{ variables.newGroup }}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuPortal>
        </ContextMenuSub>
        <ContextMenuSeparator :class="menu.separator" />
        <ContextMenuItem
          :class="dangerItem"
          data-test-id="variables-delete-selected"
          @select="emit('remove')"
        >
          <icon-lucide-trash-2 :class="menu.icon" />
          {{ variables.deleteVariables }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
