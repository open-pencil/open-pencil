export default {
  slots: {
    // Framed like the JSON viewer it replaces, with the same 16rem cap.
    root: 'max-h-64 divide-y divide-border overflow-x-hidden overflow-y-auto rounded border border-border bg-panel',
    empty: 'rounded border border-border bg-panel px-2 py-1.5 text-muted',
    source: 'min-w-0 space-y-0.5 px-2 py-1.5',
    // A button only spans its text, so it needs the row's width before it can truncate.
    title:
      'block w-full cursor-pointer truncate text-start text-2xs font-medium text-primary hover:underline focus-visible:underline',
    meta: 'truncate text-muted',
    text: 'line-clamp-3 text-surface'
  }
} as const
