/**
 * Cloud's pages for signing in and answering requests, laid out as the app's startup notice: one
 * narrow column a little above the middle, under the app icon, with a quiet footer.
 */
export default {
  slots: {
    page: 'flex h-full min-h-0 flex-col overflow-y-auto bg-canvas text-surface',
    main: 'flex flex-1 flex-col items-center justify-center px-4 pt-12 pb-[12vh]',
    column: 'flex w-full max-w-[360px] flex-col gap-6',
    header: 'flex flex-col items-center gap-4 text-center',
    icon: 'size-12 rounded-xl',
    headingGroup: 'flex flex-col gap-1.5',
    title: 'text-xl font-semibold text-balance',
    description: 'text-sm text-pretty text-muted',
    body: 'flex flex-col gap-4',
    aside: 'flex flex-wrap items-center justify-center gap-1 text-sm text-muted',
    footer:
      'flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-xs text-muted',
    footerLink: 'hover:text-surface hover:underline',
    tile: 'flex size-12 items-center justify-center rounded-xl bg-panel-field text-muted',
    actions: 'flex flex-col gap-2'
  },
  variants: {
    tone: {
      neutral: {},
      success: { tile: 'bg-success/10 text-success' },
      waiting: {}
    }
  },
  defaultVariants: { tone: 'neutral' }
} as const
