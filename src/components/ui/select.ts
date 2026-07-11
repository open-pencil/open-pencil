import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

const trigger = tv({
  base: 'flex items-center justify-between border border-border bg-input text-surface outline-none hover:bg-hover'
})

const content = tv({
  base: 'z-[120] min-w-[var(--reka-select-trigger-width)] overflow-hidden border border-border bg-panel',
  variants: {
    radius: {
      md: 'rounded-md',
      lg: 'rounded-lg'
    },
    elevation: {
      lg: 'shadow-lg',
      xl: 'shadow-xl'
    },
    padding: {
      none: '',
      sm: 'p-0.5',
      md: 'p-1'
    }
  },
  defaultVariants: {
    radius: 'md',
    elevation: 'lg',
    padding: 'sm'
  }
})

const item = tv({
  base: 'relative flex cursor-pointer items-center text-surface outline-none data-[highlighted]:bg-hover'
})

export interface SelectUi {
  trigger?: string
  content?: string
  contentVariants?: {
    radius?: 'md' | 'lg'
    elevation?: 'lg' | 'xl'
    padding?: 'none' | 'sm' | 'md'
  }
  item?: string
}

export function useSelectUI(ui?: SelectUi) {
  return {
    trigger: twMerge(trigger(), ui?.trigger),
    content: twMerge(content(ui?.contentVariants), ui?.content),
    item: twMerge(item(), ui?.item)
  }
}
