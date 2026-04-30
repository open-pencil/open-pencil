import { useVariablesDialogState } from '#vue/variables/dialog/use'
import { useVariablesTable } from '#vue/variables/table/use'
import { useVueTable, getCoreRowModel } from '@tanstack/vue-table'
import { computed, type Component } from 'vue'

/**
 * Composes variables dialog state, table columns, and TanStack table wiring
 * into a single higher-level variables editor API.
 */
export function useVariablesEditor(options: {
  /** Component used for color variable editing. */
  colorInput: Component
  /** Icon map keyed by variable resolved type. */
  icons: Record<string, Component>
  /** Fallback icon when no specific icon matches a variable type. */
  fallbackIcon: Component
  /** Icon used for destructive remove actions. */
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
