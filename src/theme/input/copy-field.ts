export default {
  slots: {
    root: 'flex min-w-0 items-center justify-between gap-2',
    value: 'min-w-0 select-all break-all text-surface',
    copy: ''
  },
  variants: {
    look: {
      /** A command to run, set apart like a terminal line. */
      command: { root: 'rounded bg-input px-2.5 py-1.5', value: 'font-mono text-2xs' },
      /** An address or token inside a settings row. */
      plain: { value: 'text-xs' },
      /** A one-time code a person reads or compares, set large and spaced out. */
      /** The code centered in the whole field, the copy button apart at its end. */
      code: {
        root: 'relative w-full justify-center rounded-lg border border-border bg-input px-10 py-3',
        value: 'text-center font-mono text-lg tracking-[0.3em]',
        copy: 'absolute end-2 top-1/2 -translate-y-1/2'
      }
    }
  },
  defaultVariants: {
    look: 'command' as const
  }
}
