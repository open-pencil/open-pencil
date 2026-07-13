import { tv } from 'tailwind-variants'

import theme from '@/theme/icon-button'

export interface IconButtonUI {
  base?: string
}

export function useIconButtonUI(options?: {
  size?: keyof typeof theme.variants.size
  active?: boolean
  disabled?: boolean
  ui?: IconButtonUI
}) {
  const iconButton = tv(theme)
  return {
    base: iconButton({
      size: options?.size,
      active: options?.active,
      disabled: options?.disabled,
      class: options?.ui?.base
    })
  }
}
