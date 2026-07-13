import { createAndBindNumberVariable } from '#vue/controls/binding-provider/number'
import { useVariableBinding } from '#vue/controls/variable-binding/use'

export type NumberBindingPath =
  | 'width'
  | 'height'
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight'
  | 'cornerRadius'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'bottomLeftRadius'
  | 'bottomRightRadius'
  | 'itemSpacing'
  | 'counterAxisSpacing'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'opacity'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'paragraphSpacing'
  | 'paragraphIndent'

export function useNumberVariableBinding(path: NumberBindingPath) {
  const binding = useVariableBinding({
    type: 'FLOAT',
    path
  })

  function createAndBindVariable(nodeId: string, value: number, name?: string) {
    createAndBindNumberVariable(binding.store, { nodeId, path: binding.bindingPath() }, value, name)
  }

  return {
    ...binding,
    numberVariables: binding.variables,
    createAndBindVariable
  }
}
