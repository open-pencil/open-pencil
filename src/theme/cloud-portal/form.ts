/** Cloud's sign-in forms: compact in the editor's dialogs, larger on the server's own pages. */
export default {
  slots: {
    form: 'flex flex-col gap-3',
    methods: 'flex flex-col gap-1.5',
    divider: 'flex items-center gap-3 text-muted',
    dividerLine: 'h-px flex-1 bg-border',
    submit: 'w-full justify-center',
    inlineLink: '',
    code: 'w-full text-center font-mono text-base tracking-[0.4em]',
    /** A code the page shows for the person to compare with the one on their screen. */
    shownCode: 'flex flex-col items-center gap-2 rounded-lg border border-border px-4 py-4',
    shownCodeLabel: 'text-xs text-muted',
    shownCodeValue: 'font-mono text-xl tracking-[0.3em] text-surface'
  },
  variants: {
    size: {
      md: { divider: 'text-2xs' },
      lg: { form: 'gap-4', methods: 'gap-2', divider: 'text-xs', inlineLink: 'h-auto px-0' }
    }
  },
  defaultVariants: { size: 'md' }
} as const
