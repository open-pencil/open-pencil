<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'

import {
  editorCommandMetadata,
  formatShortcut,
  useEditorCommands,
  type EditorCommandId
} from '@open-pencil/vue/editor/commands'
import { AUTO_ARRANGE_GROUPS } from '@open-pencil/vue/editor/menu-model'
import { useI18n } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

const { getCommand, runCommand } = useEditorCommands()
const { panels, menu } = useI18n()
const { open: popupOpen, portalActive } = useRetainedPopup()

// Figma's alignment row offers the first group; Pack and Auto Arrange follow it.
const groups = [
  ['selection.tidyUp', 'selection.distributeVertical', 'selection.distributeHorizontal'],
  ['selection.packHorizontal', 'selection.packVertical']
] satisfies EditorCommandId[][]

const menuCls = useMenuUI({ content: 'min-w-56' })
const itemCls = menuItem({ justify: 'between' })
const testId = (id: EditorCommandId) => `alignment-action-${id.replace('selection.', '')}`
</script>

<template>
  <DropdownMenuRoot v-model:open="popupOpen">
    <DropdownMenuTrigger as-child>
      <IconButton
        :label="panels.moreAlignmentActions"
        size="xs"
        data-test-id="alignment-more-actions"
      >
        <icon-lucide-ellipsis class="size-3.5" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal v-if="portalActive">
      <DropdownMenuContent align="end" side="bottom" :side-offset="4" :class="menuCls.content">
        <MenuScrollArea>
          <template v-for="(group, index) in groups" :key="index">
            <DropdownMenuSeparator v-if="index > 0" :class="menuCls.separator" />
            <DropdownMenuItem
              v-for="id in group"
              :key="id"
              :data-test-id="testId(id)"
              :class="itemCls"
              :disabled="!getCommand(id).enabled.value"
              @select="runCommand(id)"
            >
              <span>{{ getCommand(id).label }}</span>
              <span class="ml-6 text-[11px] text-muted">{{
                formatShortcut(editorCommandMetadata(id).shortcut)
              }}</span>
            </DropdownMenuItem>
          </template>
          <DropdownMenuSeparator :class="menuCls.separator" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              data-test-id="alignment-auto-arrange"
              :class="[menuCls.subTrigger, 'justify-between data-[highlighted]:bg-hover']"
              :disabled="!getCommand('selection.arrangeSpread').enabled.value"
            >
              {{ menu.autoArrange }}
              <icon-lucide-chevron-right :class="menuCls.icon" />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent :side-offset="4" :class="menuCls.content">
                <MenuScrollArea>
                  <template v-for="(group, index) in AUTO_ARRANGE_GROUPS" :key="index">
                    <DropdownMenuSeparator v-if="index > 0" :class="menuCls.separator" />
                    <DropdownMenuItem
                      v-for="id in group"
                      :key="id"
                      :data-test-id="testId(id)"
                      :class="itemCls"
                      @select="runCommand(id)"
                    >
                      {{ getCommand(id).label }}
                    </DropdownMenuItem>
                  </template>
                </MenuScrollArea>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
