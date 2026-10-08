export default {
  slots: {
    root: 'flex min-w-0 items-center justify-between gap-2',
    value: 'min-w-0 select-all break-all text-surface'
  },
  variants: {
    look: {
      /** A command to run, set apart like a terminal line. */
      command: { root: 'rounded bg-input px-2.5 py-1.5', value: 'font-mono text-[11px]' },
      /** An address or token inside a settings row. */
      plain: { value: 'text-xs' }
    }
  },
  defaultVariants: {
    look: 'command' as const
  }
}
