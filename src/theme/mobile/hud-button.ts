import { tv } from 'tailwind-variants'

export const hudButton = tv({
  slots: {
    base: 'border border-white/10 bg-panel/70 text-surface shadow-md backdrop-blur-xl hover:bg-panel/90 active:bg-hover',
    icon: 'size-3.5 shrink-0'
  },
  variants: { iconOnly: { true: { base: 'size-8 p-0' }, false: {} } }
})
