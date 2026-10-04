import { tv } from 'tailwind-variants'

export const presencePopover = tv({
  slots: {
    dot: 'size-2 rounded-full bg-green-500',
    content: 'z-50 w-56 rounded-xl bg-panel p-3 shadow-[0_8px_30px_rgb(0_0_0/0.4)]',
    peerRow:
      'flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-0.5 outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent'
  }
})
