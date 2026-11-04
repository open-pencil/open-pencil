import type { Editor } from '@open-pencil/core'
import { VISIBILITY_VARIABLE_TYPES, variableTruthy } from '@open-pencil/scene-graph/variables'

import { useOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import type { BindingTarget } from '#vue/controls/binding-provider/types'

/** Whether a variable shows the layer: a boolean as it is, text unless it reads as false. */
function resolveVisibility(editor: Editor, id: string, target?: BindingTarget) {
  return variableTruthy(
    target
      ? editor.graph.resolveVariableForNode(target.nodeId, id)
      : editor.graph.resolveVariable(id)
  )
}

/** Binds a layer's visibility to a boolean or text variable, as Figma's layer panel does. */
export function useVisibilityBindingProvider() {
  return useOpenPencilBindingProvider<boolean>({
    types: VISIBILITY_VARIABLE_TYPES,
    resolve: resolveVisibility
  })
}
