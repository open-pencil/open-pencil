<script setup lang="ts">
import { ref, computed, watch, nextTick, h, type Component } from 'vue'
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
import ColorInput from './ColorInput.vue'
import { colorToHexRaw, parseColor } from '@open-pencil/core'
import { useEditorStore } from '@/stores/editor'
import type { Variable, VariableCollection, VariableValue, Color } from '@open-pencil/core'

const open = defineModel<boolean>('open', { default: false })
const store = useEditorStore()
const searchTerm = ref('')

const collections = computed(() => {
  void store.state.sceneVersion
  return [...store.graph.variableCollections.values()]
})

const activeTab = ref(collections.value[0]?.id ?? '')
watch(collections, (cols) => {
  if (!activeTab.value && cols[0]) activeTab.value = cols[0].id
})

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
  const collection = store.graph.variableCollections.get(id)
  if (collection && value && value !== collection.name) {
    const oldName = collection.name
    store.undo.push({
      label: 'Rename collection',
      forward: () => {
        store.graph.variableCollections.set(id, { ...collection, name: value })
        store.requestRender()
      },
      inverse: () => {
        store.graph.variableCollections.set(id, { ...collection, name: oldName })
        store.requestRender()
      }
    })
    store.graph.variableCollections.set(id, { ...collection, name: value })
    store.requestRender()
  }
  editingCollectionId.value = null
}

const activeModes = computed(() => {
  const col = store.graph.variableCollections.get(activeTab.value)
  return col?.modes ?? []
})

const variables = computed(() => {
  void store.state.sceneVersion
  if (!activeTab.value) return []
  const all = store.graph.getVariablesForCollection(activeTab.value)
  if (!searchTerm.value) return all
  const q = searchTerm.value.toLowerCase()
  return all.filter((v) => v.name.toLowerCase().includes(q))
})

function formatModeValue(variable: Variable, modeId: string): string {
  const value = variable.valuesByMode[modeId]
  if (value === undefined) return '—'
  if (typeof value === 'object' && 'r' in value) return colorToHexRaw(value as Color)
  if (typeof value === 'object' && 'aliasId' in value) {
    const aliased = store.graph.variables.get(value.aliasId)
    return aliased ? `→ ${aliased.name}` : '→ ?'
  }
  return String(value)
}

function shortName(variable: Variable): string {
  const parts = variable.name.split('/')
  return parts[parts.length - 1] ?? variable.name
}

function commitNameEdit(variable: Variable, newName: string) {
  if (newName && newName !== variable.name) {
    const oldName = variable.name
    store.undo.push({
      label: 'Rename variable',
      forward: () => {
        variable.name = newName
        store.requestRender()
      },
      inverse: () => {
        variable.name = oldName
        store.requestRender()
      }
    })
    variable.name = newName
    store.requestRender()
  }
}

function updateColorValue(variable: Variable, modeId: string, color: Color) {
  const oldValue = structuredClone(variable.valuesByMode[modeId])
  store.undo.push({
    label: 'Change variable value',
    forward: () => {
      variable.valuesByMode[modeId] = color
      store.requestRender()
    },
    inverse: () => {
      variable.valuesByMode[modeId] = oldValue
      store.requestRender()
    }
  })
  variable.valuesByMode[modeId] = color
  store.requestRender()
}

function commitValueEdit(variable: Variable, modeId: string, newValue: string) {
  const oldValue = structuredClone(variable.valuesByMode[modeId])
  let parsed: VariableValue
  if (variable.type === 'COLOR') {
    parsed = parseColor(newValue.startsWith('#') ? newValue : `#${newValue}`)
  } else if (variable.type === 'FLOAT') {
    const num = parseFloat(newValue)
    if (isNaN(num)) return
    parsed = num
  } else if (variable.type === 'BOOLEAN') {
    parsed = newValue === 'true'
  } else {
    parsed = newValue
  }
  store.undo.push({
    label: 'Change variable value',
    forward: () => {
      variable.valuesByMode[modeId] = parsed
      store.requestRender()
    },
    inverse: () => {
      variable.valuesByMode[modeId] = oldValue
      store.requestRender()
    }
  })
  variable.valuesByMode[modeId] = parsed
  store.requestRender()
}

function addVariable() {
  const col = store.graph.variableCollections.get(activeTab.value)
  if (!col) return

  const id = `var:${Date.now()}`
  const valuesByMode: Record<string, VariableValue> = {}
  for (const mode of col.modes) {
    valuesByMode[mode.modeId] = { r: 0, g: 0, b: 0, a: 1 }
  }

  const variable: Variable = {
    id,
    name: 'New variable',
    type: 'COLOR',
    collectionId: col.id,
    valuesByMode,
    description: '',
    hiddenFromPublishing: false
  }
  store.undo.push({
    label: 'Create variable',
    forward: () => {
      store.graph.addVariable(variable)
      store.requestRender()
    },
    inverse: () => {
      store.graph.removeVariable(id)
      store.requestRender()
    }
  })
  store.graph.addVariable(variable)
  store.requestRender()
}

function addCollection() {
  const id = `col:${Date.now()}`
  const collection: VariableCollection = {
    id,
    name: 'New collection',
    modes: [{ modeId: 'default', name: 'Mode 1' }],
    defaultModeId: 'default',
    variableIds: []
  }
  const prevTab = activeTab.value
  store.undo.push({
    label: 'Create collection',
    forward: () => {
      store.graph.addCollection(collection)
      activeTab.value = id
      store.requestRender()
    },
    inverse: () => {
      store.graph.removeCollection(id)
      activeTab.value = prevTab
      store.requestRender()
    }
  })
  store.graph.addCollection(collection)
  activeTab.value = id
  store.requestRender()
}

function removeVariable(id: string) {
  const variable = store.graph.variables.get(id)
  if (!variable) return
  const snapshot = structuredClone(variable)
  store.undo.push({
    label: 'Delete variable',
    forward: () => {
      store.graph.removeVariable(id)
      store.requestRender()
    },
    inverse: () => {
      store.graph.addVariable(snapshot)
      store.requestRender()
    }
  })
  store.graph.removeVariable(id)
  store.requestRender()
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
      const VARIABLE_TYPE_ICONS: Record<string, Component> = {
        COLOR: IconPalette,
        FLOAT: IconHash,
        STRING: IconType,
        BOOLEAN: IconToggleLeft
      }
      const iconComponent = VARIABLE_TYPE_ICONS[v.type] ?? IconToggleLeft
      const icon = h(iconComponent, { class: iconClass })

      return h('div', { class: 'flex items-center gap-2' }, [
        icon,
        h(
          EditableRoot,
          {
            defaultValue: shortName(v),
            class: 'min-w-0 flex-1',
            onSubmit: (val: string) => commitNameEdit(v, val)
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
          onUpdate: (c: Color) => updateColorValue(v, mode.modeId, c)
        })
      }

      return h(
        EditableRoot,
        {
          defaultValue: formatModeValue(v, mode.modeId),
          class: 'min-w-0 flex-1',
          onSubmit: (val: string) => commitValueEdit(v, mode.modeId, val)
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
        class="fixed left-1/2 top-1/2 z-50 flex h-[75vh] w-[800px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-panel shadow-2xl outline-none"
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
          <TabsRoot v-model="activeTab" class="flex flex-1 flex-col overflow-hidden">
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
                    class="cursor-pointer whitespace-nowrap rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
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
                <button
                  data-test-id="variables-add-collection"
                  class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
                  title="Add collection"
                  @click="addCollection"
                >
                  <icon-lucide-folder-plus class="size-3.5" />
                </button>
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
                          class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none"
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
