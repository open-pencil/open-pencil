import { colorToCSS } from '@open-pencil/core/color'

import type { Color, Variable } from '@open-pencil/core/scene-graph'

export type ColorVariableBindingApi = {
  store: {
    resolveColorVariable: (id: string) => unknown
  }
  colorVariables: { value: Variable[] }
  filteredVariables: { value: Variable[] }
  searchTerm: { value: string }
  getBoundVariable: (nodeId: string, index: number) => Variable | undefined
  bindVariable: (nodeId: string, index: number, variableId: string) => void
  unbindVariable: (nodeId: string, index: number) => void
}

export function opacityPercent(opacity: number) {
  return Math.round(opacity * 100)
}

export function opacityFromPercent(percent: number) {
  return Math.max(0, Math.min(1, percent / 100))
}

export function variableSwatchBackground(bindingApi: ColorVariableBindingApi, variableId: string) {
  const color = bindingApi.store.resolveColorVariable(variableId) as Color | null
  return color ? colorToCSS(color) : '#000'
}
