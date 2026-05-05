<script setup lang="ts">
import { watch, type Component } from 'vue'
import { templateRef } from '@vueuse/core'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'
import { FlexRender } from '@tanstack/vue-table'

import { useI18n, useVariablesEditor } from '@open-pencil/vue'

import IconHash from '~icons/lucide/hash'
import IconPalette from '~icons/lucide/palette'
import IconToggleLeft from '~icons/lucide/toggle-left'
import IconType from '~icons/lucide/type'
import IconX from '~icons/lucide/x'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import Tip from './ui/Tip.vue'
import { useDialogUI } from '@/components/ui/dialog'
import { useMenuUI } from '@/components/ui/menu'

import type { VariableType } from '@open-pencil/core/scene-graph'

const open = defineModel<boolean>('open', { default: false })
const cls = useDialogUI({ content: 'flex h-[75vh] w-[800px] max-w-[90vw] flex-col' })
const menuCls = useMenuUI({ content: 'w-44' })

const variableTypeIcons: Record<VariableType, Component> = {
  COLOR: IconPalette,
  FLOAT: IconHash,
  STRING: IconType,
  BOOLEAN: IconToggleLeft
}

const { dialogs, panels, variableTypes: variableTypeText } = useI18n()

const variableTypes: Array<{
  type: VariableType
  label: () => string
  description: () => string
}> = [
  {
    type: 'COLOR',
    label: () => variableTypeText.value.color,
    description: () => variableTypeText.value.colorHint
  },
  {
    type: 'FLOAT',
    label: () => variableTypeText.value.number,
    description: () => variableTypeText.value.numberHint
  },
  {
    type: 'STRING',
    label: () => variableTypeText.value.text,
    description: () => variableTypeText.value.textHint
  },
  {
    type: 'BOOLEAN',
    label: () => variableTypeText.value.boolean,
    description: () => variableTypeText.value.booleanHint
  }
]

const ctx = useVariablesEditor({
  colorInput: ColorInput,
  icons: variableTypeIcons,
  fallbackIcon: IconToggleLeft,
  deleteIcon: IconX
})
const collectionInput = templateRef<HTMLInputElement>('collectionInput')

watch(collectionInput, (input) => {
  void ctx.focusCollectionInput(input)
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent data-test-id="variables-dialog" :class="cls.content">
        <div v-if="!ctx.hasCollections" class="flex flex-1 flex-col">
          <div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <DialogTitle class="text-sm font-semibold text-surface">{{
              dialogs.localVariables
            }}</DialogTitle>
            <DialogClose
              class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
            >
              <icon-lucide-x class="size-4" />
            </DialogClose>
          </div>
          <div class="flex flex-1 items-center justify-center">
            <div class="text-center">
              <p class="text-sm text-muted">{{ dialogs.noVariableCollections }}</p>
              <button
                data-test-id="variables-create-collection"
                class="mt-2 cursor-pointer rounded bg-hover px-3 py-1.5 text-xs text-surface hover:bg-border"
                @click="ctx.addCollection"
              >
                {{ dialogs.createCollection }}
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <TabsRoot
            v-model="ctx.activeCollectionId.value"
            class="flex flex-1 flex-col overflow-hidden"
          >
            <div class="flex shrink-0 items-center border-b border-border">
              <TabsList class="flex flex-1 gap-0.5 overflow-x-auto px-3 py-1">
                <template v-for="col in ctx.collections.value" :key="col.id">
                  <input
                    v-if="ctx.editingCollectionId.value === col.id"
                    ref="collectionInput"
                    class="w-24 rounded border border-accent bg-input px-2 py-0.5 text-xs text-surface outline-none"
                    :value="col.name"
                    @blur="ctx.commitRenameCollection(col.id, $event.target as HTMLInputElement)"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                    @keydown.escape="ctx.editingCollectionId.value = null"
                  />
                  <TabsTrigger
                    v-else
                    :value="col.id"
                    data-test-id="variables-collection-tab"
                    class="cursor-pointer rounded border-none px-2.5 py-1 text-xs whitespace-nowrap text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
                    @dblclick="ctx.startRenameCollection(col.id)"
                  >
                    {{ col.name }}
                  </TabsTrigger>
                </template>
              </TabsList>

              <div class="flex items-center gap-1.5 px-3">
                <div class="flex items-center gap-1 rounded border border-border px-2 py-0.5">
                  <icon-lucide-search class="size-3 text-muted" />
                  <input
                    v-model="ctx.searchTerm.value"
                    data-test-id="variables-search-input"
                    class="w-24 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                    :placeholder="dialogs.search"
                  />
                </div>
                <Tip :label="dialogs.createCollection">
                  <button
                    data-test-id="variables-add-collection"
                    class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
                    @click="ctx.addCollection"
                  >
                    <icon-lucide-folder-plus class="size-3.5" />
                  </button>
                </Tip>
                <DialogClose
                  class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
                >
                  <icon-lucide-x class="size-4" />
                </DialogClose>
              </div>
            </div>

            <TabsContent
              v-for="col in ctx.collections.value"
              :key="col.id"
              :value="col.id"
              class="flex flex-1 flex-col overflow-hidden outline-none"
            >
              <div class="flex-1 overflow-auto">
                <table
                  class="w-full border-collapse"
                  :style="{ width: `${ctx.table.getCenterTotalSize()}px` }"
                >
                  <thead class="sticky top-0 z-10 bg-panel">
                    <tr
                      v-for="headerGroup in ctx.table.getHeaderGroups()"
                      :key="headerGroup.id"
                      class="border-b border-border"
                    >
                      <th
                        v-for="header in headerGroup.headers"
                        :key="header.id"
                        class="relative px-4 py-2 text-left text-[11px] font-medium text-muted"
                        :style="{ width: `${header.getSize()}px` }"
                      >
                        <FlexRender
                          v-if="!header.isPlaceholder"
                          :render="header.column.columnDef.header"
                          :props="header.getContext()"
                        />
                        <div
                          v-if="header.column.getCanResize()"
                          class="absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none"
                          :class="
                            header.column.getIsResizing()
                              ? 'bg-accent'
                              : 'bg-transparent hover:bg-border'
                          "
                          @mousedown="header.getResizeHandler()?.($event)"
                          @touchstart="header.getResizeHandler()?.($event)"
                          @dblclick="header.column.resetSize()"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in ctx.table.getRowModel().rows"
                      :key="row.id"
                      data-test-id="variable-row"
                      class="group border-b border-border/30 hover:bg-hover/50"
                    >
                      <td
                        v-for="cell in row.getVisibleCells()"
                        :key="cell.id"
                        class="px-4 py-1.5"
                        :style="{ width: `${cell.column.getSize()}px` }"
                      >
                        <FlexRender
                          :render="cell.column.columnDef.cell"
                          :props="cell.getContext()"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="flex w-full shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-2">
                <span class="text-xs text-muted">{{ panels.createVariable }}</span>
                <DropdownMenuRoot>
                  <DropdownMenuTrigger as-child>
                    <button
                      data-test-id="variables-add-variable"
                      class="flex cursor-pointer items-center gap-1.5 rounded bg-hover px-2.5 py-1.5 text-xs text-surface hover:bg-border"
                    >
                      <icon-lucide-plus class="size-3.5" />
                      {{ panels.add }}
                      <icon-lucide-chevron-down class="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuContent side="top" :side-offset="8" align="end" :class="menuCls.content">
                      <DropdownMenuItem
                        v-for="item in variableTypes"
                        :key="item.type"
                        :class="menuCls.item"
                        :data-test-id="`variables-add-${item.type.toLowerCase()}`"
                        @select="ctx.addVariable(item.type)"
                      >
                        <component :is="variableTypeIcons[item.type]" :class="menuCls.icon" />
                        <span class="flex min-w-0 flex-1 flex-col">
                          <span>{{ item.label() }}</span>
                          <span class="truncate text-[10px] text-muted">{{ item.description() }}</span>
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenuRoot>
              </div>
            </TabsContent>
          </TabsRoot>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
