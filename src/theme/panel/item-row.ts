export default {
  slots: {
    root: 'group grid min-h-6 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1.5 py-0.5',
    content: 'flex min-w-0 items-center gap-1.5',
    rail: 'flex shrink-0 items-center gap-0.5',
    details: 'col-span-2 min-w-0',
    remove: ''
  }
} as const
