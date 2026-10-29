import {
  useTextContentBindingProvider,
  useVisibilityBindingProvider
} from '@open-pencil/vue/controls/binding-provider'

/** The layer fields a component property or a variable can decide, as Figma's layer panel offers. */
export type BoundLayerField = 'VISIBLE' | 'TEXT'

export const BOUND_LAYER_FIELDS = {
  VISIBLE: {
    path: 'visible',
    propertyType: 'BOOLEAN',
    undoLabel: 'Bind visibility',
    /** Outside a component the eye opens the list; there is no button to name. */
    buttonLabel: 'applyVariable',
    useProvider: useVisibilityBindingProvider
  },
  TEXT: {
    path: 'text',
    propertyType: 'TEXT',
    undoLabel: 'Bind text content',
    buttonLabel: 'applyVariableToTextContent',
    useProvider: useTextContentBindingProvider
  }
} as const
