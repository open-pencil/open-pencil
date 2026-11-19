export default {
  slots: {
    root: 'flex min-w-0 items-center justify-between gap-2',
    value: 'min-w-0 select-all break-all text-surface'
  },
  variants: {
    look: {
      /** A command to run, set apart like a terminal line. */
      command: { root: 'rounded bg-input px-2.5 py-1.5', value: 'font-mono text-2xs' },
      /** An address or token inside a settings row. */
      plain: { value: 'text-xs' },
      /** A one-time code a person reads or compares, set large and spaced out. */
      code: {
        root: 'w-full rounded-lg border border-border bg-input py-3 ps-4',
        value: 'flex-1 text-center font-mono text-lg tracking-[0.3em]'
      }
    }
  },
  defaultVariants: {
    look: 'command' as const
  }
}
