export default {
  slots: {
    root: 'group flex min-h-6 items-center gap-1.5 py-0.5',
    content: 'flex min-w-0 flex-1 items-center gap-1.5',
    rail: 'flex shrink-0 items-center gap-0.5',
    remove:
      'transition-opacity [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
  }
} as const
