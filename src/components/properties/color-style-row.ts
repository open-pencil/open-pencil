import { colorToCSS } from '@open-pencil/core/color'
import type { Color, Fill, Variable } from '@open-pencil/core/scene-graph'

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
  createAndBindVariable?: (nodeId: string, index: number, color: Color, name?: string) => void
}

export function opacityPercent(opacity: number) {
  return Math.round(opacity * 100)
}

export function opacityFromPercent(percent: number) {
  return Math.max(0, Math.min(1, percent / 100))
}

function isColor(value: unknown): value is Color {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value &&
    typeof value.r === 'number' &&
    typeof value.g === 'number' &&
    typeof value.b === 'number' &&
    typeof value.a === 'number'
  )
}

export function variableSwatchBackground(bindingApi: ColorVariableBindingApi, variableId: string) {
  const color = bindingApi.store.resolveColorVariable(variableId)
  return isColor(color) ? colorToCSS(color) : 'transparent'
}

export function boundVariableColor(
  bindingApi: ColorVariableBindingApi,
  nodeId: string,
  index: number
): Color | undefined {
  const variable = bindingApi.getBoundVariable(nodeId, index)
  if (!variable) return undefined
  const color = bindingApi.store.resolveColorVariable(variable.id)
  return isColor(color) ? color : undefined
}

export function boundVariableSwatchBackground(
  bindingApi: ColorVariableBindingApi,
  nodeId: string,
  index: number
): string | undefined {
  const color = boundVariableColor(bindingApi, nodeId, index)
  return color ? colorToCSS(color) : undefined
}

export function displayFillWithBoundVariable(
  bindingApi: ColorVariableBindingApi,
  nodeId: string,
  index: number,
  fill: Fill
): Fill {
  const color = fill.type === 'SOLID' ? boundVariableColor(bindingApi, nodeId, index) : undefined
  return color ? { ...fill, color } : fill
}
