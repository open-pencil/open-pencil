/**
 * A month of days for picking a span: the ends are solid, the days between a tint, and the
 * span under the pointer previews in the same tint before the second click.
 */
export default {
  slots: {
    root: 'flex flex-col gap-2 text-xs',
    header: 'flex items-center justify-between gap-2',
    heading: 'text-xs font-semibold',
    grid: 'w-full border-collapse select-none',
    headCell: 'h-7 w-8 text-center text-[10px] font-medium text-muted',
    cell: 'p-0 text-center',
    day: [
      'mx-auto flex size-8 cursor-pointer items-center justify-center rounded-md tabular-nums outline-none',
      'hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus',
      'data-[today]:font-semibold data-[today]:text-primary',
      'data-[highlighted]:rounded-none data-[highlighted]:bg-accent/15',
      'data-[selected]:rounded-none data-[selected]:bg-accent/15',
      'data-[selection-start]:rounded-l-md data-[selection-start]:bg-accent data-[selection-start]:text-on-accent',
      'data-[selection-end]:rounded-r-md data-[selection-end]:bg-accent data-[selection-end]:text-on-accent',
      'data-[highlighted-start]:rounded-l-md data-[highlighted-end]:rounded-r-md',
      'data-[outside-view]:text-muted/50',
      'data-[unavailable]:cursor-default data-[unavailable]:text-muted/40 data-[unavailable]:hover:bg-transparent',
      'data-[disabled]:cursor-default data-[disabled]:text-muted/40 data-[disabled]:hover:bg-transparent'
    ]
  }
} as const
