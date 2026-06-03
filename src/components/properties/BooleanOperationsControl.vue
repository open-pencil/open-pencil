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

import { editorCommandMetadata, formatShortcut, useEditorCommands, useI18n } from '@inkly/vue'
import type { EditorCommandId } from '@inkly/vue'

import Tip from '@/components/ui/Tip.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu'

const { getCommand, runCommand } = useEditorCommands()
const { commands } = useI18n()

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
  <DropdownMenuRoot>
    <Tip :label="commands.booleanOperations">
      <DropdownMenuTrigger as-child>
        <button
          data-test-id="boolean-operations-trigger"
          class="flex h-7 items-center gap-1 rounded-md px-1.5 text-muted hover:bg-hover hover:text-surface data-[state=open]:bg-active data-[state=open]:text-surface"
        >
          <IconCombine class="size-4" />
          <IconChevronDown class="size-3" />
        </button>
      </DropdownMenuTrigger>
    </Tip>
    <DropdownMenuPortal>
      <DropdownMenuContent align="end" side="bottom" :side-offset="4" :class="menuCls.content">
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
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
