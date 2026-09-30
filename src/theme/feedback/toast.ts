import { motionStyles } from '@/theme/motion/styles'

const toastTheme = {
  slots: {
    root: 'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none flex max-w-sm items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=move]:translate-y-[var(--reka-toast-swipe-move-y)]',
    icon: 'mt-0.5 size-3 shrink-0',
    content: 'min-w-0 flex-1',
    message: 'select-text',
    count: 'ml-1.5 opacity-70',
    progress: 'mt-1.5 flex flex-col gap-1',
    progressTrack: 'h-1 w-full overflow-hidden rounded-full bg-current/25',
    progressFill:
      'h-full rounded-full bg-current transition-[width] duration-150 ease-out motion-reduce:transition-none',
    progressLabel: 'text-[10px] leading-none tabular-nums opacity-80',
    action:
      'shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium underline-offset-2 hover:underline',
    control: 'mt-0.5 shrink-0 cursor-pointer rounded p-0.5 opacity-70 hover:opacity-100'
  },
  variants: {
    tone: {
      default: { root: 'bg-accent text-white' },
      warning: {
        root: 'border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
      },
      error: { root: 'bg-red-600 text-white' }
    },
    // A determinate bar takes its width from the consumer; an indeterminate one
    // pulses in place so the toast still reads as work in progress.
    progress: {
      none: {},
      determinate: { icon: motionStyles.spinner },
      indeterminate: {
        icon: motionStyles.spinner,
        progressFill: 'motion-reduce:animate-none w-1/3 animate-pulse'
      }
    }
  },
  defaultVariants: { tone: 'default' as const, progress: 'none' as const }
} as const

export default toastTheme
