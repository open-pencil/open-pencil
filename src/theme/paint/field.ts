import { panelFieldBase } from '../panel/field/base'

/** A paint row: swatch, value, opacity, and variable button in one field. */
export default {
  slots: {
    root: 'flex flex-1 items-center overflow-hidden',
    preview: 'flex shrink-0 items-center',
    value: 'flex min-w-0 flex-1 items-center pe-1',
    divider: 'h-4 w-px shrink-0 bg-muted/40',
    opacity: 'h-full w-13 flex-none shrink-0',
    binding: 'flex shrink-0 items-center'
  },
  variants: {
    /**
     * `panel` stands on the properties panel's field; `form` on the bordered input of forms such
     * as the variables inspector, so a colour reads like the fields beside it there.
     */
    tone: {
      panel: {
        root: [panelFieldBase, 'text-2xs'],
        preview: 'ps-1',
        value: 'ps-1',
        binding: 'pe-0.5'
      },
      form: {
        root: 'h-7 min-w-0 rounded-md border border-border bg-input text-xs text-surface hover:border-muted/60 focus-within:border-panel-focus focus-within:ring-1 focus-within:ring-accent/25',
        preview: 'ps-2',
        value: 'ps-1.5',
        binding: 'pe-1'
      }
    }
  },
  defaultVariants: { tone: 'panel' }
} as const
