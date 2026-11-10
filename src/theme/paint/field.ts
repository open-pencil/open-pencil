import { panelFieldBase } from '../panel/field/base'

/** A paint row: swatch, value, opacity, and variable button on the panel's field frame. */
export default {
  slots: {
    root: [panelFieldBase, 'flex flex-1 items-center overflow-hidden text-2xs'],
    preview: 'flex shrink-0 items-center ps-1',
    value: 'flex min-w-0 flex-1 items-center ps-1 pe-1',
    divider: 'h-4 w-px shrink-0 bg-muted/40',
    opacity: 'h-full w-13 flex-none shrink-0',
    binding: 'flex shrink-0 items-center pe-0.5'
  }
} as const
