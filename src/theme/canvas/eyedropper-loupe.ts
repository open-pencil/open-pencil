/**
 * The eyedropper's loupe, centred on the pointer in place of the cursor: the screen pixels around
 * it, enlarged on a grid with the picked one outlined, and that pixel's colour below. Nine pixels
 * a side at 0.5rem each (`EYEDROPPER_LOUPE_PIXELS`) inside 0.375rem of padding, so the centre
 * pixel starts at 2rem and its centre sits 2.625rem from the card's corner
 * (`LOUPE_CENTRE_OFFSET_REM`).
 */
export default {
  slots: {
    content:
      'pointer-events-none fixed top-0 inset-s-0 z-50 flex flex-col gap-1.5 rounded-lg bg-panel p-1.5 text-surface shadow-[0_0_0_1px_var(--color-border),0_8px_30px_rgb(0_0_0/0.4)]',
    loupe: 'relative size-18 overflow-hidden rounded-md',
    pixels: 'block size-full [image-rendering:pixelated]',
    grid: 'absolute inset-0 bg-[image:linear-gradient(to_right,rgb(0_0_0/0.12)_0.0625rem,transparent_0.0625rem),linear-gradient(to_bottom,rgb(0_0_0/0.12)_0.0625rem,transparent_0.0625rem)] bg-[size:0.5rem_0.5rem]',
    centre:
      'absolute top-8 inset-s-8 size-2 shadow-[0_0_0_1px_rgb(0_0_0),0_0_0_2px_rgb(255_255_255)]',
    value: 'flex items-center gap-1.5 px-0.5 font-mono text-2xs leading-4',
    swatch: 'size-3 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]'
  }
} as const
