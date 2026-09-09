import { panelFieldBase, panelFieldState } from '../panel/field'

const defaultInputBase =
  'min-w-0 rounded-md border border-border bg-input text-surface outline-none hover:border-muted/60 focus:border-panel-focus focus:ring-1 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60'

export const inputAdornment = {
  root: 'relative flex min-w-0 shrink-0 items-center',
  leading: 'pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted',
  trailing: 'absolute inset-y-0 right-2 flex items-center gap-1 text-muted'
}

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
    density: {
      compact: '',
      comfortable: 'h-12 px-3.5 text-base'
    },
    state: panelFieldState
  },
  defaultVariants: {
    tone: 'default' as const,
    size: 'xs' as const,
    state: 'idle' as const
  }
}
