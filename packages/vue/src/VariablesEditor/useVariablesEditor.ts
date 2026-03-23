import { computed, type Component } from 'vue'
import { useVueTable, getCoreRowModel } from '@tanstack/vue-table'

import { useVariablesDialogState } from './useVariablesDialogState'
import { useVariablesTable } from './useVariablesTable'

export function useVariablesEditor(options: {
  colorInput: Component
  icons: Record<string, Component>
  fallbackIcon: Component
  deleteIcon: Component
}) {
  const ctx = useVariablesDialogState()

  const { columns } = useVariablesTable({
    activeModes: ctx.activeModes,
    formatModeValue: ctx.formatModeValue,
    parseVariableValue: ctx.parseVariableValue,
    shortName: ctx.shortName,
    renameVariable: ctx.renameVariable,
    updateVariableValue: ctx.updateVariableValue,
    removeVariable: ctx.removeVariable,
    ColorInput: options.colorInput,
    icons: options.icons,
    fallbackIcon: options.fallbackIcon,
    deleteIcon: options.deleteIcon
  })

  const table = useVueTable({
    get data() {
      return ctx.variables.value
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

  const hasCollections = computed(() => ctx.collections.value.length > 0)

  return {
    ...ctx,
    columns,
    table,
    hasCollections
  }
}
