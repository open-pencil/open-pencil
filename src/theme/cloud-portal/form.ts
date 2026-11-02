/** Cloud's sign-in fields: compact in the editor's dialogs, larger on the server's own pages. */
export default {
  slots: {
    form: 'flex flex-col gap-3',
    field: 'flex flex-col gap-1.5',
    labelRow: 'flex items-center justify-between',
    label: 'font-medium',
    hint: 'text-muted',
    error: 'text-error',
    methods: 'flex flex-col gap-1.5',
    divider: 'flex items-center gap-3 text-muted',
    dividerLine: 'h-px flex-1 bg-border',
    submit: 'w-full justify-center',
    inlineLink: '',
    code: 'w-full text-center font-mono text-base tracking-[0.4em]'
  },
  variants: {
    size: {
      md: {
        label: 'text-[11px] text-muted',
        hint: 'text-[11px]',
        error: 'text-[11px]',
        divider: 'text-[11px]'
      },
      lg: {
        form: 'gap-4',
        label: 'text-sm text-surface',
        hint: 'text-xs',
        error: 'text-xs',
        methods: 'gap-2',
        divider: 'text-xs',
        inlineLink: 'h-auto px-0'
      }
    }
  },
  defaultVariants: { size: 'md' }
} as const
