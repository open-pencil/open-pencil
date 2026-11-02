/**
 * The eyedropper's loupe, centred on the pointer in place of the cursor: the screen pixels around
 * it, enlarged on a grid with the picked one outlined, and that pixel's colour below. Nine pixels
 * a side at 8 px each (`EYEDROPPER_LOUPE_PIXELS`) inside 6 px of padding, so the centre pixel
 * starts at 32 px and its centre sits 42 px from the card's corner.
 */
export default {
  slots: {
    content:
      'pointer-events-none fixed top-0 left-0 z-50 flex flex-col gap-1.5 rounded-lg bg-panel p-1.5 text-surface shadow-[0_0_0_1px_var(--color-border),0_8px_30px_rgb(0_0_0/0.4)]',
    loupe: 'relative size-[72px] overflow-hidden rounded-md',
    pixels: 'block size-full [image-rendering:pixelated]',
    grid: 'absolute inset-0 bg-[image:linear-gradient(to_right,rgb(0_0_0/0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.12)_1px,transparent_1px)] bg-[size:8px_8px]',
    centre:
      'absolute top-[32px] left-[32px] size-2 shadow-[0_0_0_1px_rgb(0_0_0),0_0_0_2px_rgb(255_255_255)]',
    value: 'flex items-center gap-1.5 px-0.5 font-mono text-[11px] leading-4',
    swatch: 'size-3 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]'
  }
} as const
