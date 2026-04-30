import { useEditor } from '#vue/editor/context'
import { useFilter } from 'reka-ui'
import { computed, ref } from 'vue'

import type { Variable } from '@open-pencil/core/scene-graph'

type ColorBindingKind = 'fills' | 'strokes'

export function useColorVariableBinding(kind: ColorBindingKind) {
  const store = useEditor()
  const colorVariables = computed(() => store.getVariablesByType('COLOR'))
  const searchTerm = ref('')
  const { contains } = useFilter({ sensitivity: 'base' })
  const filteredVariables = computed(() => {
    if (!searchTerm.value) return colorVariables.value
    return colorVariables.value.filter((v) => contains(v.name, searchTerm.value))
  })

  function bindingPath(index: number) {
    return `${kind}/${index}/color`
  }

  function getBoundVariable(nodeId: string, index: number): Variable | undefined {
    const n = store.getNode(nodeId)
    if (!n) return undefined
    const varId = n.boundVariables[bindingPath(index)]
    return varId ? store.getVariable(varId) : undefined
  }

  function bindVariable(nodeId: string, index: number, variableId: string) {
    store.bindVariable(nodeId, bindingPath(index), variableId)
  }

  function unbindVariable(nodeId: string, index: number) {
    store.unbindVariable(nodeId, bindingPath(index))
  }

  return {
    store,
    colorVariables,
    searchTerm,
    filteredVariables,
    getBoundVariable,
    bindVariable,
    unbindVariable
  }
}
