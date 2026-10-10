import { tv } from 'tailwind-variants'

/** Cloud's own pages outside the editor: a centered card for sign-in, a sidebar for the console. */
export const portalLayout = tv({
  slots: {
    page: 'flex h-full min-h-0 flex-col overflow-hidden bg-app text-surface',
    bar: 'flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel px-4',
    barTitle: 'text-xs font-semibold',
    barHost: 'text-[11px] text-muted',
    barEnd: 'ml-auto flex items-center gap-2',
    center: 'flex flex-1 items-start justify-center overflow-y-auto px-4 py-12 sm:items-center',
    card: 'flex w-full max-w-sm flex-col gap-5 rounded-xl border border-border bg-panel p-6 shadow-[0_8px_30px_rgb(0_0_0/0.18)]',
    cardHeader: 'flex flex-col gap-1',
    cardTitle: 'text-sm font-semibold text-surface',
    cardDescription: 'text-xs leading-relaxed text-muted',
    cardFooter: 'border-t border-border pt-4 text-center text-[11px] text-muted',
    console: 'flex min-h-0 flex-1',
    main: 'min-w-0 flex-1 overflow-y-auto',
    mainInner: 'mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6',
    pageTitle: 'text-base font-semibold',
    pageDescription: 'mt-0.5 text-xs text-muted'
  }
})
