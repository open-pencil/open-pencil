/** Version history in the right sidebar: the document's versions on a timeline, as in Figma. */
export default {
  slots: {
    panel: 'flex min-h-0 flex-1 flex-col',
    list: 'scrollbar-thin min-h-0 flex-1 overflow-y-auto py-1',
    item: 'group/item relative px-2',
    // The line between markers runs through the gutter beside each entry.
    itemButton:
      'grid w-full cursor-pointer grid-cols-[24px_minmax(0,1fr)] gap-x-2 rounded-md px-1 py-1.5 pr-8 text-left text-xs outline-none hover:bg-hover focus-visible:bg-hover data-[selected]:bg-panel-selected-muted',
    marker: 'relative flex justify-center pt-0.5',
    ring: 'relative z-10 size-4 rounded-full border-2 border-muted bg-panel group-data-[selected]/item:border-accent',
    dot: 'relative z-10 mt-1 size-2 rounded-full bg-muted group-data-[selected]/item:bg-accent',
    line: 'absolute top-0 bottom-[-0.75rem] left-1/2 w-px -translate-x-1/2 bg-border',
    body: 'flex min-w-0 flex-col gap-0.5',
    title: 'min-w-0 truncate font-semibold text-surface',
    current: 'min-w-0 truncate font-semibold text-surface group-data-[selected]/item:text-accent',
    description: 'line-clamp-3 min-w-0 break-words text-surface/80',
    author: 'min-w-0 truncate text-[11px] text-muted',
    time: 'text-[11px] text-muted',
    actions:
      'invisible absolute top-1.5 right-3 group-focus-within/item:visible group-hover/item:visible group-data-[selected]/item:visible group-data-[menu-open]/item:visible',
    more: 'flex justify-center px-3 py-2',
    status: 'px-4 py-3 text-xs text-muted',
    menuIndicator: 'absolute left-2',
    form: 'flex flex-col gap-3',
    label: 'sr-only'
  }
} as const
