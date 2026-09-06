export default {
  base: 'flex cursor-pointer items-center justify-center bg-transparent text-muted outline-none hover:bg-hover hover:text-surface focus-visible:border-panel-focus',
  variants: {
    size: {
      xs: 'size-6 rounded border border-transparent text-sm leading-none',
      sm: 'size-7 rounded-md border border-transparent text-sm leading-none',
      md: 'size-8 rounded-md border border-transparent text-base leading-none'
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
