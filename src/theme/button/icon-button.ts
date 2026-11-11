import { focusStyles } from '../focus/styles'

export default {
  // The icon passes the pointer to the button: Reka's Splitter only sees that a control covers
  // its resize handle when the event target is an HTML element, so a press or hover on an SVG
  // icon over a handle, as in a picker beside the properties panel, reached the handle.
  // A button that opens a menu or popover reads as open while it is (`aria-expanded`); its
  // trigger's own `data-state` is replaced by the button's on and off.
  base: [
    'flex cursor-pointer items-center justify-center bg-transparent text-muted outline-none hover:bg-hover hover:text-surface aria-expanded:bg-hover aria-expanded:text-surface [&_svg]:pointer-events-none',
    focusStyles.ring
  ],
  variants: {
    size: {
      xs: 'h-6 w-6 rounded border border-transparent text-sm leading-none',
      sm: 'h-7 w-7 rounded-md border border-transparent text-sm leading-none',
      md: 'h-8 w-8 rounded-md border border-transparent text-base leading-none',
      lg: 'h-9 w-9 rounded-md border border-transparent text-base leading-none'
    },
    /** A button that opens a menu shows a chevron after its icon and grows to fit it. */
    menu: {
      true: 'w-auto gap-0.5 px-1',
      false: ''
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
    menu: false as const,
    active: false as const,
    disabled: false as const
  }
}
