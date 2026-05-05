import { computed } from 'vue'

import { createVariableColumns, type VariablesTableOptions } from '#vue/variables/table/helpers'

export function useVariablesTable(options: VariablesTableOptions) {
  const columns = computed(() => createVariableColumns(options))

  return { columns }
}
