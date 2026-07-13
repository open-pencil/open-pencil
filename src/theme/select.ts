import { panelFieldBase } from './panel/field'

export default {
  slots: {
    trigger: [panelFieldBase, 'flex items-center justify-between'],
    value: 'min-w-0 flex-1 truncate text-left',
    content:
      'z-[110] min-w-[var(--reka-select-trigger-width)] overflow-hidden border border-border bg-panel',
    viewport: '',
    item: 'relative flex cursor-pointer items-center text-surface outline-none select-none data-[disabled]:pointer-events-none data-[highlighted]:bg-hover data-[disabled]:opacity-50'
  },
  variants: {
    radius: {
      md: { content: 'rounded-md' },
      lg: { content: 'rounded-lg' }
    },
    elevation: {
      lg: { content: 'shadow-lg' },
      xl: { content: 'shadow-xl' }
    },
    padding: {
      none: { content: '' },
      sm: { content: 'p-0.5' },
      md: { content: 'p-1' }
    }
  },
  defaultVariants: {
    radius: 'md' as const,
    elevation: 'lg' as const,
    padding: 'sm' as const
  }
}
