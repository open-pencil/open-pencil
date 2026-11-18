export default {
  slots: {
    root: 'relative w-full max-w-full overflow-hidden rounded border border-border bg-input select-none data-[mode=highlight]:[&>img:first-child]:opacity-40',
    image: 'absolute inset-0 size-full object-contain',
    // `cqw` is the split's width, so each side draws the whole image and its panel crops it.
    split: '@container absolute inset-0',
    panel: 'relative h-full overflow-hidden',
    before: 'absolute inset-y-0 inset-s-0 h-full w-[100cqw] max-w-none object-contain',
    after: 'absolute inset-y-0 inset-e-0 h-full w-[100cqw] max-w-none object-contain',
    divider: 'bg-accent shadow-[0_0_0_1px_rgb(0_0_0/0.25)]',
    label:
      'pointer-events-none absolute top-1 rounded bg-black/55 px-1 py-px text-4xs font-medium text-white'
  }
} as const
