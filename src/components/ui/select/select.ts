import { tv } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/select/select'

export interface AppSelectOption<TValue extends string | number> {
  value: TValue
  label: string
  disabled?: boolean
}

export interface AppSelectGroup<TValue extends string | number> {
  /** Heading above the group; groups without one are only set apart by a separator. */
  label?: string
  options: AppSelectOption<TValue>[]
}

export type SelectPlacement = keyof typeof theme.variants.placement

export interface SelectContentVariants {
  placement?: SelectPlacement
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
    chevron: styles.chevron({ class: ui?.chevron }),
    content: styles.content({ class: ui?.content }),
    viewport: styles.viewport({ class: ui?.viewport }),
    scrollButton: styles.scrollButton({ class: ui?.scrollButton }),
    item: styles.item({ class: ui?.item }),
    indicator: styles.indicator({ class: ui?.indicator }),
    label: styles.label({ class: ui?.label }),
    separator: styles.separator({ class: ui?.separator })
  }
}
