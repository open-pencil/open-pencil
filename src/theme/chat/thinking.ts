/**
 * Bars fill with the level and shift from cool to warm as the model thinks harder: the primary
 * blue, growing stronger, then the theme's violet and pink, so both themes keep the order.
 */
export default {
  slots: {
    meter:
      'inline-flex h-3 shrink-0 items-end gap-px text-muted data-[level=high]:text-component data-[level=low]:text-primary/80 data-[level=medium]:text-primary data-[level=minimal]:text-primary/60 data-[level=xhigh]:text-slot',
    bar: 'w-[3px] rounded-[1px] bg-current data-[filled=false]:bg-muted/30',
    trigger: 'flex shrink-0 items-center',
    /** Narrow composers show only the meter, leaving the width to the model name. */
    label: 'hidden truncate @[16rem]:inline',
    option: 'ml-auto pl-3'
  }
} as const
