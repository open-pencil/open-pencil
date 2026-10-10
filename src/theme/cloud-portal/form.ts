import { tv } from 'tailwind-variants'

export const portalForm = tv({
  slots: {
    form: 'flex flex-col gap-3',
    field: 'flex flex-col gap-1.5',
    labelRow: 'flex items-center justify-between',
    label: 'text-[11px] font-medium text-muted',
    hint: 'text-[11px] text-muted',
    methods: 'flex flex-col gap-1.5',
    divider: 'flex items-center gap-3 text-[11px] text-muted',
    dividerLine: 'h-px flex-1 bg-border',
    submit: 'w-full justify-center',
    code: 'w-full text-center font-mono text-base tracking-[0.4em]'
  }
})
