import { useFilter } from 'reka-ui'
import { computed, ref } from 'vue'

import { useEditor } from '../context/editorContext'

import type { Variable } from '@open-pencil/core'

export function useFillVariableBinding() {
  const store = useEditor()
  const colorVariables = computed(() => store.getVariablesByType('COLOR'))
  const searchTerm = ref('')
  const { contains } = useFilter({ sensitivity: 'base' })
  const filteredVariables = computed(() => {
    if (!searchTerm.value) return colorVariables.value
    return colorVariables.value.filter((v) => contains(v.name, searchTerm.value))
  })

  function getBoundVariable(nodeId: string, index: number): Variable | undefined {
    const n = store.getNode(nodeId)
    if (!n) return undefined
    const varId = n.boundVariables[`fills/${index}/color`]
    return varId ? store.getVariable(varId) : undefined
  }

  function bindFillVariable(nodeId: string, index: number, variableId: string) {
    store.bindVariable(nodeId, `fills/${index}/color`, variableId)
  }

  function unbindFillVariable(nodeId: string, index: number) {
    store.unbindVariable(nodeId, `fills/${index}/color`)
  }

  return {
    store,
    colorVariables,
    searchTerm,
    filteredVariables,
    getBoundVariable,
    bindFillVariable,
    unbindFillVariable
  }
}
