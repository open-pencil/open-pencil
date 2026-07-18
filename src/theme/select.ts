import { panelFieldBase } from './panel/field'

export default {
  slots: {
    trigger: [panelFieldBase, 'flex items-center justify-between text-[11px]'],
    value: 'min-w-0 flex-1 truncate text-left',
    content:
      'z-[110] min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-xl bg-panel text-[11px] shadow-[0_8px_30px_rgb(0_0_0/0.4)]',
    viewport: '',
    item: 'relative flex h-6 cursor-pointer items-center text-surface outline-none select-none data-[disabled]:pointer-events-none data-[highlighted]:bg-hover data-[disabled]:opacity-50'
  },
  variants: {
    radius: {
      md: { content: 'rounded-md' },
      lg: { content: 'rounded-xl' }
    },
    elevation: {
      lg: { content: 'shadow-[0_8px_30px_rgb(0_0_0/0.4)]' },
      xl: { content: 'shadow-[0_8px_30px_rgb(0_0_0/0.4)]' }
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
