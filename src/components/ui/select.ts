import { tv } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/select'

export interface SelectContentVariants {
  radius?: keyof typeof theme.variants.radius
  elevation?: keyof typeof theme.variants.elevation
  padding?: keyof typeof theme.variants.padding
}

export type SelectUI = ComponentUI<typeof theme> & {
  contentVariants?: SelectContentVariants
}

export function useSelectUI(ui?: SelectUI) {
  const styles = tv(theme)(ui?.contentVariants)
  return {
    trigger: styles.trigger({ class: ui?.trigger }),
    value: styles.value({ class: ui?.value }),
    content: styles.content({ class: ui?.content }),
    viewport: styles.viewport({ class: ui?.viewport }),
    item: styles.item({ class: ui?.item })
  }
}
