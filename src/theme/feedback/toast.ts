import { motionStyles } from '@/theme/motion/styles'

const toastTheme = {
  slots: {
    root: 'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none flex max-w-sm items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=move]:translate-y-[var(--reka-toast-swipe-move-y)]',
    icon: 'mt-0.5 size-3 shrink-0',
    content: 'min-w-0 flex-1',
    message: 'select-text',
    count: 'ml-1.5',
    progress: 'mt-1.5',
    // A filled button that darkens the toast, so its text keeps the toast's contrast.
    action:
      'shrink-0 cursor-pointer rounded px-2 py-0.5 text-[11px] leading-4 font-medium transition-colors focus-visible:outline-1 focus-visible:outline-current',
    control: 'mt-0.5 shrink-0 cursor-pointer rounded p-0.5 opacity-70 hover:opacity-100'
  },
  variants: {
    tone: {
      default: { root: 'bg-accent text-on-accent', action: 'bg-black/20 hover:bg-black/30' },
      warning: {
        root: 'border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
        action: 'bg-current/10 hover:bg-current/15'
      },
      error: { root: 'bg-red-600 text-white', action: 'bg-black/20 hover:bg-black/30' }
    },
    // Work in progress spins the icon; AppProgress draws the bar.
    progress: {
      none: {},
      determinate: { icon: motionStyles.spinner },
      indeterminate: { icon: motionStyles.spinner }
    }
  },
  defaultVariants: { tone: 'default' as const, progress: 'none' as const }
} as const

export default toastTheme
