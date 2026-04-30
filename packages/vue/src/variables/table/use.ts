import { createVariableColumns, type VariablesTableOptions } from '#vue/variables/table/helpers'
import { computed } from 'vue'

export function useVariablesTable(options: VariablesTableOptions) {
  const columns = computed(() => createVariableColumns(options))

  return { columns }
}
