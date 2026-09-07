import { tv } from 'tailwind-variants'

export const documentEntry = tv({
  slots: {
    root: 'group min-w-0',
    trigger:
      'min-w-0 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50',
    preview:
      'flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field transition-colors group-hover:border-panel-focus',
    image: 'size-full object-cover transition-transform duration-200 group-hover:scale-[1.015]',
    fallback: 'size-8 text-muted/40',
    icon: 'size-4 shrink-0 text-accent',
    body: 'min-w-0 flex-1',
    name: 'block truncate text-xs font-medium',
    metadata: 'mt-0.5 block truncate text-[10px] text-muted',
    trailingMetadata: 'hidden shrink-0 text-[10px] text-muted sm:inline',
    actions: 'flex shrink-0 items-center gap-1'
  },
  variants: {
    view: {
      grid: { body: 'mt-2 block', trailingMetadata: 'hidden sm:hidden' },
      list: {
        root: 'flex items-center border-b border-border last:border-b-0 hover:bg-hover',
        trigger: 'flex min-h-14 items-center gap-3 px-3 py-2 sm:min-h-0 sm:px-4 sm:py-3',
        metadata: 'sm:hidden'
      }
    }
  },
  defaultVariants: { view: 'grid' }
})
