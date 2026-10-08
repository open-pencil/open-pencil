import { tv } from 'tailwind-variants'

/** Marks a canvas that follows someone: a border in their color and a bar to stop. */
export const followFrame = tv({
  slots: {
    root: 'pointer-events-none absolute inset-0 z-30 border-2',
    bar: 'pointer-events-auto absolute top-0 left-1/2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1.5 rounded-b-md py-1 pr-1 pl-2.5 text-[11px] font-medium shadow-md',
    icon: 'size-3 shrink-0',
    label: 'min-w-0 truncate',
    stop: 'shrink-0 cursor-pointer rounded bg-current/15 px-1.5 py-0.5 text-[11px] font-medium outline-none hover:bg-current/25 focus-visible:ring-1 focus-visible:ring-current'
  }
})
