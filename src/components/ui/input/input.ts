import { tv } from 'tailwind-variants'

import { inputTheme } from '@open-pencil/vue/theme'

export interface InputUI {
  base?: string
}

export function useInputUI(options?: {
  tone?: keyof typeof inputTheme.variants.tone
  size?: keyof typeof inputTheme.variants.size
  state?: keyof typeof inputTheme.variants.state
  ui?: InputUI
}) {
  const input = tv(inputTheme)
  return {
    base: input({
      tone: options?.tone,
      size: options?.size,
      state: options?.state,
      class: options?.ui?.base
    })
  }
}
