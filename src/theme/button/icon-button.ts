export default {
  // The icon passes the pointer to the button: Reka's Splitter only sees that a control covers
  // its resize handle when the event target is an HTML element, so a press or hover on an SVG
  // icon over a handle, as in a picker beside the properties panel, reached the handle.
  base: 'flex cursor-pointer items-center justify-center bg-transparent text-muted outline-none hover:bg-hover hover:text-surface focus-visible:border-panel-focus [&_svg]:pointer-events-none',
  variants: {
    size: {
      xs: 'size-6 rounded border border-transparent text-sm leading-none',
      sm: 'size-7 rounded-md border border-transparent text-sm leading-none',
      md: 'size-8 rounded-md border border-transparent text-base leading-none',
      lg: 'size-9 rounded-md border border-transparent text-base leading-none'
    },
    active: {
      true: 'border-accent text-primary'
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
