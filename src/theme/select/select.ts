import { motionStyles } from '../motion/styles'
import { floatingSurface } from '../overlay'
import { panelFieldBase } from '../panel/field'

export default {
  slots: {
    trigger: [panelFieldBase, 'flex items-center justify-between text-[11px]'],
    value: 'min-w-0 flex-1 truncate text-left',
    content: [
      'z-[110] min-w-[var(--reka-select-trigger-width)] overflow-hidden text-[11px]',
      floatingSurface,
      motionStyles.floating
    ],
    viewport: '',
    item: 'relative flex h-6 cursor-pointer items-center text-surface outline-none select-none data-[disabled]:pointer-events-none data-[highlighted]:bg-hover data-[disabled]:opacity-50'
  },
  variants: {
    padding: {
      none: { content: '' },
      sm: { content: 'p-0.5' },
      md: { content: 'p-1' }
    }
  },
  defaultVariants: {
    padding: 'sm' as const
  }
}
