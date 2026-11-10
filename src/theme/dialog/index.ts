import { motionStyles } from '@/theme/motion/styles'

export default {
  slots: {
    overlay: ['fixed inset-0 z-40 bg-black/50', motionStyles.overlay],
    content: [
      'fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,48rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-panel shadow-[0_8px_30px_rgb(0_0_0/0.4)] outline-none data-[state=open]:zoom-in-98 data-[state=closed]:zoom-out-98',
      motionStyles.overlay
    ],
    header: 'flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3',
    heading: 'min-w-0',
    title: 'text-sm font-semibold text-surface data-[visually-hidden=true]:sr-only',
    description: 'text-xs text-muted',
    close:
      'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface',
    body: 'min-h-0 flex-1 overflow-y-auto p-4',
    /** Its actions sit at the end, Cancel first and the main action last. */
    footer: 'flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3',
    /** A separate action at the start, such as Delete or Copy codes; never Cancel. */
    footerStart: 'me-auto flex min-w-0 items-center gap-2',
    /** A strip of a dialog's own layout between header and footer, lined up with them. */
    pane: ''
  },
  variants: {
    size: {
      sm: { content: 'w-[min(24rem,92vw)]' },
      md: { content: 'w-[min(32rem,94vw)]' },
      lg: { content: 'w-[min(46rem,94vw)]' },
      xl: { content: 'w-[min(64rem,96vw)]' },
      /** Nearly the whole window, for editors such as the variables dialog when expanded. */
      screen: { content: 'w-[98vw]' }
    },
    height: {
      auto: {},
      tall: { content: 'h-[min(75vh,48rem)]' },
      full: { content: 'h-[min(90vh,56rem)]' },
      screen: { content: 'h-[96vh] max-h-[96vh]' }
    }
  }
} as const
