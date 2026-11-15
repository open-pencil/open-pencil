import { motionStyles } from '@/theme/motion/styles'

/**
 * A toast is a floating bar like the toolbar, on the panel colour with the toolbar's shadow, so a
 * passing notice is as quiet as the rest of the chrome. A warning or an error shows in its icon, and
 * an action is an ordinary button.
 */
const toastTheme = {
  slots: {
    root: 'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none flex min-h-9 max-w-md items-center gap-2 rounded-lg bg-panel py-1 text-xs text-surface shadow-(--floating-bar-shadow) data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=move]:translate-y-[var(--reka-toast-swipe-move-y)]',
    icon: 'size-3.5 shrink-0',
    content: 'min-w-0 flex-1 py-1',
    message: 'leading-4 select-text',
    count: 'ms-1.5 text-muted tabular-nums',
    progress: 'mt-1.5',
    action: 'shrink-0',
    controls: 'flex shrink-0 items-center'
  },
  variants: {
    // Buttons bring their own padding, so a toast that ends in one keeps a narrow edge there.
    trailing: {
      true: { root: 'pe-1 ps-3' },
      false: { root: 'px-3' }
    },
    // Work in progress spins a muted icon, and AppProgress draws the bar; a warning or an error
    // keeps its own colour.
    progress: {
      none: {},
      determinate: { icon: ['text-muted', motionStyles.spinner] },
      indeterminate: { icon: ['text-muted', motionStyles.spinner] }
    }
  },
  defaultVariants: { trailing: false, progress: 'none' as const }
} as const

export default toastTheme
