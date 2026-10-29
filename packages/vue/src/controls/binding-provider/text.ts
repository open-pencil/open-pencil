import type { Editor } from '@open-pencil/core'
import { TEXT_CONTENT_VARIABLE_TYPES, variableText } from '@open-pencil/scene-graph/variables'

import { useOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import type { BindingTarget } from '#vue/controls/binding-provider/types'

/** What a variable shows as a text layer's content: text as it is, a number formatted as text. */
function resolveTextContent(editor: Editor, id: string, target?: BindingTarget) {
  return variableText(
    target
      ? editor.graph.resolveVariableForNode(target.nodeId, id)
      : editor.graph.resolveVariable(id)
  )
}

/** Binds a text layer's content to a text or number variable, as Figma's layer panel does. */
export function useTextContentBindingProvider() {
  return useOpenPencilBindingProvider<string>({
    types: TEXT_CONTENT_VARIABLE_TYPES,
    resolve: resolveTextContent
  })
}
