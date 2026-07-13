import { tv } from 'tailwind-variants'

import theme from '@/theme/input'

export interface InputUI {
  base?: string
}

export function useInputUI(options?: {
  tone?: keyof typeof theme.variants.tone
  size?: keyof typeof theme.variants.size
  state?: keyof typeof theme.variants.state
  ui?: InputUI
}) {
  const input = tv(theme)
  return {
    base: input({
      tone: options?.tone,
      size: options?.size,
      state: options?.state,
      class: options?.ui?.base
    })
  }
}
