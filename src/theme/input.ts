import { panelFieldBase, panelFieldState } from './panel/field'

export default {
  base: 'w-full tabular-nums',
  variants: {
    tone: {
      default: panelFieldBase,
      panel: panelFieldBase
    },
    size: {
      sm: 'px-2 text-[11px]',
      md: 'px-2 text-[11px]'
    },
    state: panelFieldState
  },
  defaultVariants: {
    tone: 'default' as const,
    size: 'md' as const,
    state: 'idle' as const
  }
}
