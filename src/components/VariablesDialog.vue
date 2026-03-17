<script setup lang="ts">
import { ref, computed, nextTick, h, type Component } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  EditableRoot,
  EditableArea,
  EditableInput,
  EditablePreview
} from 'reka-ui'
import { useVueTable, getCoreRowModel, FlexRender, type ColumnDef } from '@tanstack/vue-table'

import IconPalette from '~icons/lucide/palette'
import IconHash from '~icons/lucide/hash'
import IconType from '~icons/lucide/type'
import IconToggleLeft from '~icons/lucide/toggle-left'
import IconX from '~icons/lucide/x'
import Tip from './Tip.vue'
import ColorInput from './ColorInput.vue'
import { useVariables } from '@open-pencil/vue'
import type { Variable, Color } from '@open-pencil/core'

const open = defineModel<boolean>('open', { default: false })

const {
  collections,
  variables,
  activeCollectionId,
  activeModes,
  searchTerm,
  addCollection,
  renameCollection,
  addVariable,
  removeVariable,
  renameVariable,
  updateVariableValue,
  formatModeValue,
  parseVariableValue,
  shortName
} = useVariables()

const editingCollectionId = ref<string | null>(null)
const collectionInputRefs = new Map<string, HTMLInputElement>()
const pendingCollectionFocusId = ref<string | null>(null)

function setCollectionInputRef(id: string, el: HTMLInputElement | null) {
  if (el) collectionInputRefs.set(id, el)
  else collectionInputRefs.delete(id)

  if (el && pendingCollectionFocusId.value === id) {
    pendingCollectionFocusId.value = null
    void nextTick(() => {
      el.focus()
      el.select()
    })
  }
}

function startRenameCollection(id: string) {
  editingCollectionId.value = id
  pendingCollectionFocusId.value = id
}

function commitRenameCollection(id: string, input: HTMLInputElement) {
  if (editingCollectionId.value !== id) return
  const value = input.value.trim()
  const col = collections.value.find((c) => c.id === id)
  if (col && value && value !== col.name) {
    renameCollection(id, value)
  }
  editingCollectionId.value = null
}

function commitNameEdit(variable: Variable, newName: string) {
  if (newName && newName !== variable.name) {
    renameVariable(variable.id, newName)
  }
}

function commitValueEdit(variable: Variable, modeId: string, newValue: string) {
  const parsed = parseVariableValue(variable, newValue)
  if (parsed !== undefined) {
    updateVariableValue(variable.id, modeId, parsed)
  }
}

const VARIABLE_TYPE_ICONS: Record<string, Component> = {
  COLOR: IconPalette,
  FLOAT: IconHash,
  STRING: IconType,
  BOOLEAN: IconToggleLeft
}

const columns = computed<ColumnDef<Variable>[]>(() => {
  const nameCol: ColumnDef<Variable> = {
    id: 'name',
    header: 'Name',
    size: 200,
    minSize: 120,
    maxSize: 400,
    cell: ({ row }) => {
      const v = row.original
      const iconClass = 'size-3.5 shrink-0 text-muted'
      const iconComponent = VARIABLE_TYPE_ICONS[v.type] ?? IconToggleLeft
      const icon = h(iconComponent, { class: iconClass })

      return h('div', { class: 'flex items-center gap-2' }, [
        icon,
        h(
          EditableRoot,
          {
            defaultValue: shortName(v),
            class: 'min-w-0 flex-1',
            onSubmit: (val: string | null | undefined) => val && commitNameEdit(v, val)
          },
          () =>
            h(EditableArea, { class: 'flex' }, () => [
              h(EditablePreview, {
                class: 'min-w-0 flex-1 cursor-text truncate text-xs text-surface'
              }),
              h(EditableInput, {
                class:
                  'min-w-0 flex-1 rounded border border-border bg-surface/10 px-1 py-0.5 text-xs text-surface outline-none'
              })
            ])
        )
      ])
    }
  }

  const modeCols: ColumnDef<Variable>[] = activeModes.value.map((mode) => ({
    id: `mode-${mode.modeId}`,
    header: mode.name,
    size: 200,
    minSize: 120,
    maxSize: 500,
    cell: ({ row }) => {
      const v = row.original
      const value = v.valuesByMode[mode.modeId]

      if (v.type === 'COLOR' && value && typeof value === 'object' && 'r' in value) {
        return h(ColorInput, {
          color: value as Color,
          onUpdate: (c: Color) => updateVariableValue(v.id, mode.modeId, c)
        })
      }

      return h(
        EditableRoot,
        {
          defaultValue: formatModeValue(v, mode.modeId),
          class: 'min-w-0 flex-1',
          onSubmit: (val: string | null | undefined) => val && commitValueEdit(v, mode.modeId, val)
        },
        () =>
          h(EditableArea, { class: 'flex' }, () => [
            h(EditablePreview, {
              class: 'min-w-0 flex-1 cursor-text truncate font-mono text-xs text-muted'
            }),
            h(EditableInput, {
              class:
                'min-w-0 flex-1 rounded border border-border bg-surface/10 px-1 py-0.5 font-mono text-xs text-surface outline-none'
            })
          ])
      )
    }
  }))

  const deleteCol: ColumnDef<Variable> = {
    id: 'actions',
    header: '',
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableResizing: false,
    cell: ({ row }) =>
      h(
        'button',
        {
          class:
            'flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-surface',
          onClick: () => removeVariable(row.original.id)
        },
        h(IconX, { class: 'size-3' })
      )
  }

  return [nameCol, ...modeCols, deleteCol]
})

const table = useVueTable({
  get data() {
    return variables.value
  },
  get columns() {
    return columns.value
  },
  columnResizeMode: 'onChange',
  getCoreRowModel: getCoreRowModel(),
  defaultColumn: {
    minSize: 60,
    maxSize: 800
  },
  getRowId: (row) => row.id
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <DialogContent
        data-test-id="variables-dialog"
        class="fixed top-1/2 left-1/2 z-50 flex h-[75vh] w-[800px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-panel shadow-2xl outline-none"
      >
        <div v-if="collections.length === 0" class="flex flex-1 flex-col">
          <div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <DialogTitle class="text-sm font-semibold text-surface">Local variables</DialogTitle>
            <DialogClose
              class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
            >
              <icon-lucide-x class="size-4" />
            </DialogClose>
          </div>
          <div class="flex flex-1 items-center justify-center">
            <div class="text-center">
              <p class="text-sm text-muted">No variable collections</p>
              <button
                data-test-id="variables-create-collection"
                class="mt-2 cursor-pointer rounded bg-hover px-3 py-1.5 text-xs text-surface hover:bg-border"
                @click="addCollection"
              >
                Create collection
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <TabsRoot v-model="activeCollectionId" class="flex flex-1 flex-col overflow-hidden">
            <!-- Top bar -->
            <div class="flex shrink-0 items-center border-b border-border">
              <TabsList class="flex flex-1 gap-0.5 overflow-x-auto px-3 py-1">
                <template v-for="col in collections" :key="col.id">
                  <input
                    v-if="editingCollectionId === col.id"
                    :ref="(el) => setCollectionInputRef(col.id, el as HTMLInputElement | null)"
                    class="w-24 rounded border border-accent bg-input px-2 py-0.5 text-xs text-surface outline-none"
                    :value="col.name"
                    @blur="commitRenameCollection(col.id, $event.target as HTMLInputElement)"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                    @keydown.escape="editingCollectionId = null"
                  />
                  <TabsTrigger
                    v-else
                    :value="col.id"
                    data-test-id="variables-collection-tab"
                    class="cursor-pointer rounded border-none px-2.5 py-1 text-xs whitespace-nowrap text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
                    @dblclick="startRenameCollection(col.id)"
                  >
                    {{ col.name }}
                  </TabsTrigger>
                </template>
              </TabsList>

              <div class="flex items-center gap-1.5 px-3">
                <div class="flex items-center gap-1 rounded border border-border px-2 py-0.5">
                  <icon-lucide-search class="size-3 text-muted" />
                  <input
                    v-model="searchTerm"
                    data-test-id="variables-search-input"
                    class="w-24 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                    placeholder="Search"
                  />
                </div>
                <Tip label="Add collection">
                  <button
                    data-test-id="variables-add-collection"
                    class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
                    @click="addCollection"
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

            <!-- Table -->
            <TabsContent
              v-for="col in collections"
              :key="col.id"
              :value="col.id"
              class="flex flex-1 flex-col overflow-hidden outline-none"
            >
              <div class="flex-1 overflow-auto">
                <table
                  class="w-full border-collapse"
                  :style="{ width: `${table.getCenterTotalSize()}px` }"
                >
                  <thead class="sticky top-0 z-10 bg-panel">
                    <tr
                      v-for="headerGroup in table.getHeaderGroups()"
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
                        <!-- Resize handle -->
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
                      v-for="row in table.getRowModel().rows"
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

              <!-- Footer -->
              <button
                data-test-id="variables-add-variable"
                class="flex w-full shrink-0 cursor-pointer items-center gap-1.5 border-t border-border bg-transparent px-4 py-2 text-xs text-muted hover:bg-hover hover:text-surface"
                @click="addVariable"
              >
                <icon-lucide-plus class="size-3.5" />
                Create variable
              </button>
            </TabsContent>
          </TabsRoot>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
