import { panelIconButtonBase } from './panel/field'

export default {
  base: 'flex cursor-pointer items-center justify-center bg-transparent text-muted outline-none hover:bg-hover hover:text-surface focus-visible:border-panel-focus',
  variants: {
    size: {
      sm: 'size-5 rounded border-none text-sm leading-none',
      md: panelIconButtonBase
    },
    active: {
      true: 'border-accent text-accent'
    },
    disabled: {
      true: 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted'
    }
  },
  defaultVariants: {
    size: 'sm' as const,
    active: false as const,
    disabled: false as const
  }
}
