import type { Editor } from '@lawha/core'
import { TEXT_CONTENT_VARIABLE_TYPES, variableText } from '@lawha/scene-graph/variables'

import { useLawhaBindingProvider } from '#vue/controls/binding-provider/lawha'
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
  return useLawhaBindingProvider<string>({
    types: TEXT_CONTENT_VARIABLE_TYPES,
    resolve: resolveTextContent
  })
}
