import { tv } from 'tailwind-variants'

/** A pin's bubble is this many pixels square: `p-1` around a 24px avatar, or `size-8`. */
export const COMMENT_PIN_SIZE = 32

/** Canvas comments: pins, the thread card beside a pin, and the list in the right sidebar. */
export const comments = tv({
  slots: {
    // Below the toolbar and other floating UI, above the canvas.
    layer: 'pointer-events-none absolute inset-0 z-0',
    capture: 'pointer-events-auto absolute inset-0 cursor-crosshair',
    // Pins sit at their zoomed canvas positions in here; panning only moves this layer.
    pins: 'absolute top-0 left-0',
    // A 32px speech bubble whose square corner points at the commented spot, as Figma draws it;
    // hovering opens it in place into a preview of the comment.
    pin: 'group/pin pointer-events-auto absolute flex -translate-y-full cursor-pointer touch-none items-start rounded-2xl rounded-bl-none bg-panel p-1 text-left shadow-md ring-1 ring-black/10 outline-none select-none hover:shadow-lg focus-visible:ring-2 focus-visible:ring-accent data-[active]:ring-2 data-[active]:ring-accent data-[draft]:pointer-events-none data-[draft]:size-8 data-[draft]:bg-accent data-[dragging]:cursor-grabbing data-[dragging]:shadow-lg data-[resolved]:grayscale',
    // Grows from nothing to its content's size, so the bubble opens smoothly in both directions.
    pinPreview:
      'grid grid-cols-[0fr] grid-rows-[0fr] opacity-0 transition-[grid-template-columns,grid-template-rows,opacity] duration-150 ease-out group-hover/pin:grid-cols-[1fr] group-hover/pin:grid-rows-[1fr] group-hover/pin:opacity-100 group-focus-visible/pin:grid-cols-[1fr] group-focus-visible/pin:grid-rows-[1fr] group-focus-visible/pin:opacity-100 motion-reduce:transition-none',
    pinPreviewClip: 'min-h-0 min-w-0 overflow-hidden',
    pinPreviewBody: 'flex w-max max-w-56 flex-col py-0.5 pr-2 pl-2 text-xs',
    pinText: 'line-clamp-2 break-words text-surface',
    card: 'flex max-h-[min(28rem,70vh)] w-80 flex-col overflow-hidden p-0',
    // A new comment is the composer alone, floating beside its pin, as in Figma.
    draftCard:
      'w-72 rounded-[20px] p-0 focus-within:shadow-[0_0_0_1px_var(--color-accent),0_8px_30px_rgb(0_0_0/0.4)]',
    threadCard: 'flex min-h-0 flex-col',
    thread: 'scrollbar-thin flex min-h-0 flex-col gap-3 overflow-y-auto px-3 py-2.5',
    message: 'group/message grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 gap-y-0.5',
    messageMeta: 'flex h-6 min-w-0 items-center gap-1.5 text-xs',
    messageAuthor: 'min-w-0 truncate font-semibold text-surface',
    messageTime: 'shrink-0 text-[11px] text-muted',
    messageActions:
      'ml-auto flex shrink-0 opacity-0 group-focus-within/message:opacity-100 group-hover/message:opacity-100',
    messageText: 'col-start-2 min-w-0 text-xs break-words text-surface',
    composerSlot: 'border-t border-border p-2',
    // One line with the send button beside it, growing as the comment does, as in Figma.
    composer:
      'flex items-end gap-1 rounded-lg border border-border bg-input py-1 pr-1 pl-3 focus-within:border-panel-focus focus-within:ring-1 focus-within:ring-accent/25',
    composerInput:
      'scrollbar-thin max-h-40 min-w-0 flex-1 resize-none bg-transparent py-0.5 text-xs leading-5 text-surface outline-none placeholder:text-muted',
    panel: 'flex min-h-0 flex-1 flex-col',
    panelSearch: 'shrink-0 border-b border-border px-3 py-2',
    list: 'scrollbar-thin min-h-0 flex-1 overflow-y-auto',
    item: 'group/item relative border-b border-border/60 hover:bg-hover data-[active]:bg-panel-selected-muted',
    itemButton:
      'flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left text-xs outline-none focus-visible:bg-hover',
    itemTop: 'flex h-6 items-center gap-1.5 pr-14',
    itemPlace: 'min-w-0 truncate text-[11px] text-muted',
    itemMeta: 'flex min-w-0 items-baseline gap-1.5',
    itemText: 'line-clamp-3 min-w-0 break-words text-surface/80',
    itemReplies: 'text-[11px] text-muted',
    itemActions:
      'invisible absolute top-2 right-2 flex gap-0.5 group-focus-within/item:visible group-hover/item:visible group-data-[menu-open]/item:visible',
    menuIndicator: 'absolute left-2'
  },
  variants: {
    /** A composer that is its card's whole content and takes the card's edge. */
    bare: {
      true: {
        composer:
          'rounded-[20px] border-0 bg-transparent py-1.5 pr-1.5 focus-within:border-0 focus-within:ring-0'
      }
    }
  }
})
