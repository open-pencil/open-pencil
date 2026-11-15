export default {
  slots: {
    trigger:
      'min-w-0 max-w-full gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-3xs text-muted',
    triggerIcon: 'size-3 shrink-0',
    triggerValue: 'min-w-0 truncate',
    triggerChevron: 'size-2.5 shrink-0',
    /** The list of the shared select, wide enough for a profile's name and model. */
    content: 'w-72 max-w-[calc(100vw-1rem)]',
    /** A row of two lines, where the shared select's is one. */
    item: 'h-auto py-1',
    text: 'block min-w-0',
    name: 'block truncate font-medium',
    /** The model and where it runs, as the combobox sets an option's second line. */
    metadata: 'block truncate text-4xs text-muted',
    capability: 'ms-auto size-3 shrink-0 text-muted',
    /** Laid out as a row of the list, with its icon where a row has its check. */
    footer:
      'relative flex h-6 w-full cursor-pointer items-center rounded-md pe-2 ps-6 text-start text-muted outline-none hover:bg-hover hover:text-surface focus-visible:bg-hover',
    footerIcon: 'absolute inset-s-0 inline-flex h-full w-6 items-center justify-center'
  }
} as const
