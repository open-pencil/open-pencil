import { tv } from 'tailwind-variants'

import theme from '@/theme/button/icon-button'

export interface IconButtonUI {
  base?: string
}

export function useIconButtonUI(options?: {
  size?: keyof typeof theme.variants.size
  menu?: boolean
  active?: boolean
  disabled?: boolean
  ui?: IconButtonUI
}) {
  const iconButton = tv(theme)
  return {
    base: iconButton({
      size: options?.size,
      menu: options?.menu,
      active: options?.active,
      disabled: options?.disabled,
      class: options?.ui?.base
    })
  }
}
