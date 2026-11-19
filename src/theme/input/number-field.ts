import { panelFieldBase } from '../panel/field/base'

const numberFieldTheme = {
  slots: {
    root: [
      panelFieldBase,
      'group flex min-h-6 flex-1 cursor-ew-resize items-center text-2xs tabular-nums data-[disabled]:cursor-auto data-[editing]:cursor-auto'
    ],
    leading:
      'flex shrink-0 items-center justify-center self-stretch px-1.25 text-muted select-none [&>*]:pointer-events-none',
    /**
     * While editing, the input is as wide as its text, so the unit stays right after the number
     * as it does at rest: an invisible copy of the text sets the width and the input lies over it.
     * Both take the caller's `field` classes, so padding set there applies to each.
     */
    sizer: 'relative flex min-w-0 items-center self-stretch overflow-hidden',
    field:
      'absolute inset-0 size-full min-w-0 cursor-text border-none bg-transparent p-0 pe-px font-[inherit] text-2xs text-surface outline-none',
    mirror: 'pointer-events-none invisible static block size-auto overflow-hidden whitespace-pre',
    gap: 'min-w-0 flex-1 self-stretch',
    display: 'flex min-w-0 flex-1 items-center overflow-hidden text-2xs select-none',
    mixed: 'flex-1 text-muted',
    value: 'min-w-0 truncate text-surface',
    trailing: 'flex shrink-0 items-center self-stretch pe-0.5',
    suffix: 'shrink-0 pe-1.5 text-muted'
  },
  variants: {
    /** Trailing controls are 20px boxes that bring their own spacing after the unit. */
    suffix: {
      true: { display: 'pe-0', suffix: 'pe-0.5' },
      false: { display: 'pe-1.5' }
    }
  }
}

export type NumberFieldTheme = typeof numberFieldTheme
export default numberFieldTheme
