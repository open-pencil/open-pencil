import { panelFieldBase, panelFieldState } from './panel/field'

const defaultInputBase =
  'min-w-0 rounded-md border border-border bg-input text-surface outline-none hover:border-muted/60 focus:border-panel-focus focus:ring-1 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60'

export default {
  base: 'w-full tabular-nums',
  variants: {
    tone: {
      default: defaultInputBase,
      panel: panelFieldBase
    },
    size: {
      xs: 'h-6 px-2 text-[11px]',
      sm: 'h-7 px-2.5 text-xs',
      md: 'h-8 px-3 text-xs'
    },
    state: panelFieldState
  },
  defaultVariants: {
    tone: 'default' as const,
    size: 'xs' as const,
    state: 'idle' as const
  }
}
