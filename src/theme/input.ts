import { panelFieldBase, panelFieldState } from './panel/field'

export default {
  base: 'w-full tabular-nums',
  variants: {
    tone: {
      default:
        'rounded border border-border bg-input text-surface outline-none focus:border-accent',
      panel: panelFieldBase
    },
    size: {
      sm: 'px-2 py-1 text-[11px]',
      md: 'px-2 py-1 text-xs'
    },
    state: panelFieldState
  },
  defaultVariants: {
    tone: 'default' as const,
    size: 'md' as const,
    state: 'idle' as const
  }
}
