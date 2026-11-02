<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconCombine from '~icons/lucide/combine'
import IconCopyMinus from '~icons/lucide/copy-minus'
import IconCopyX from '~icons/lucide/copy-x'
import IconListCollapse from '~icons/lucide/list-collapse'
import IconSquaresIntersect from '~icons/lucide/squares-intersect'

import {
  editorCommandMetadata,
  formatShortcut,
  useEditorCommands,
  type EditorCommandId
} from '@open-pencil/vue/editor/commands'
import { useI18n } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import Tip from '@/components/ui/overlay/Tip.vue'

const { getCommand, runCommand } = useEditorCommands()
const { commands } = useI18n()
const { open: popupOpen, portalActive } = useRetainedPopup()

const operations = [
  { id: 'selection.booleanUnion', icon: IconCombine },
  { id: 'selection.booleanSubtract', icon: IconCopyMinus },
  { id: 'selection.booleanIntersect', icon: IconSquaresIntersect },
  { id: 'selection.booleanExclude', icon: IconCopyX },
  { id: 'selection.flatten', icon: IconListCollapse }
] satisfies Array<{ id: EditorCommandId; icon: unknown }>

const menuCls = useMenuUI({ content: 'min-w-44' })
const itemCls = menuItem({ justify: 'between' })
</script>

<template>
  <DropdownMenuRoot v-model:open="popupOpen">
    <Tip :label="commands.booleanOperations">
      <DropdownMenuTrigger as-child>
        <button
          data-test-id="boolean-operations-trigger"
          class="flex h-7 items-center gap-1 rounded-md px-1.5 text-muted hover:bg-hover hover:text-surface data-[state=open]:bg-hover data-[state=open]:text-surface"
        >
          <IconCombine class="size-4" />
          <IconChevronDown class="size-3" />
        </button>
      </DropdownMenuTrigger>
    </Tip>
    <DropdownMenuPortal v-if="portalActive">
      <DropdownMenuContent align="end" side="bottom" :side-offset="4" :class="menuCls.content">
        <MenuScrollArea>
          <DropdownMenuItem
            v-for="operation in operations"
            :key="operation.id"
            :data-test-id="`boolean-operation-${operation.id.replace('selection.', '')}`"
            :class="itemCls"
            :disabled="!getCommand(operation.id).enabled.value"
            @select="runCommand(operation.id)"
          >
            <div class="flex min-w-0 items-center gap-2">
              <component :is="operation.icon" class="size-3.5 shrink-0 text-muted" />
              <span>{{ getCommand(operation.id).label }}</span>
            </div>
            <span class="ml-6 text-[11px] text-muted">{{
              formatShortcut(editorCommandMetadata(operation.id).shortcut)
            }}</span>
          </DropdownMenuItem>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
