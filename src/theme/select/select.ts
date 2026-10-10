import { motionStyles } from '../motion/styles'
import { floatingSurface } from '../overlay'
import { panelFieldBase } from '../panel/field'

/**
 * Every select list shares one row anatomy: a fixed check gutter, so labels never shift between
 * checked and unchecked rows, and group headings that line up with the labels below them.
 */
export default {
  slots: {
    trigger: [panelFieldBase, 'flex items-center justify-between text-[11px]'],
    value: 'min-w-0 flex-1 truncate text-left',
    chevron: 'ml-1 size-3 shrink-0 text-muted',
    content: ['z-[110] overflow-hidden text-[11px]', floatingSurface, motionStyles.floating],
    viewport: '',
    scrollButton: 'flex h-5 cursor-default items-center justify-center text-muted',
    item: 'relative flex h-6 cursor-pointer items-center gap-2 rounded-md pr-2 pl-6 text-surface outline-none select-none data-[disabled]:pointer-events-none data-[highlighted]:bg-hover data-[disabled]:opacity-50',
    indicator: 'absolute inset-y-0 left-0 inline-flex w-6 items-center justify-center text-primary',
    label: 'flex h-6 items-center pr-2 pl-6 text-[10px] text-muted',
    separator: 'mx-1 my-1 h-px bg-border'
  },
  variants: {
    /**
     * `over` lays the list on its trigger with the chosen row's label on the trigger's label, for
     * triggers that show the value; Reka sizes and clamps it to the window. `below` drops it under
     * triggers that show an icon or a mode.
     */
    placement: {
      over: { content: '' },
      below: {
        content:
          'max-h-[min(var(--reka-select-content-available-height),20rem)] min-w-[var(--reka-select-trigger-width)]'
      }
    },
    padding: {
      none: { content: '' },
      sm: { content: 'p-0.5' },
      md: { content: 'p-1' }
    }
  },
  defaultVariants: {
    placement: 'below' as const,
    padding: 'md' as const
  }
}
