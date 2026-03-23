import { DEFAULT_SHAPE_FILL } from '@open-pencil/core'

import { useFillVariableBinding } from './useFillVariableBinding'

export function useFillControls() {
  const ctx = useFillVariableBinding()

  return {
    ...ctx,
    defaultFill: DEFAULT_SHAPE_FILL
  }
}
