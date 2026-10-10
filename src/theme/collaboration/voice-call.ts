import { tv } from 'tailwind-variants'

/** The voice call beside the avatar stack: its trigger, mute, and the call's popover. */
export const voiceCall = tv({
  slots: {
    root: 'flex shrink-0 items-center',
    trigger: 'relative',
    /** How many people are in a call we are not in yet. */
    count:
      'absolute -top-1 -right-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-[var(--color-success-bg)] px-0.5 text-[8px] leading-none font-semibold text-white',
    chevron: 'size-2.5',
    content: 'z-50 flex w-64 flex-col gap-3 p-3',
    header: 'flex items-center justify-between gap-2',
    title: 'text-xs font-medium text-surface',
    status: 'text-[11px] text-muted',
    actions: 'flex items-center gap-1.5',
    action: 'flex-1'
  },
  variants: {
    /** In a call, mute leads and the popover opens from a narrow chevron beside it. */
    inCall: {
      true: { trigger: 'h-6 w-4' },
      false: {}
    }
  },
  defaultVariants: { inCall: false }
})
