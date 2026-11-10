import { panelFieldBase } from '../panel/field/base'

const numberFieldTheme = {
  slots: {
    root: [
      panelFieldBase,
      'group flex min-h-6 flex-1 cursor-ew-resize items-center text-2xs tabular-nums data-[disabled]:cursor-auto data-[editing]:cursor-auto'
    ],
    leading:
      'flex shrink-0 items-center justify-center self-stretch px-1.25 text-muted select-none [&>*]:pointer-events-none',
    field:
      'min-w-0 flex-1 cursor-text border-none bg-transparent pe-1.5 font-[inherit] text-2xs text-surface outline-none',
    display: 'flex min-w-0 flex-1 items-center overflow-hidden text-2xs select-none',
    mixed: 'flex-1 text-muted',
    value: 'min-w-0 flex-1 truncate text-surface',
    trailing: 'flex shrink-0 items-center self-stretch',
    suffix: 'shrink-0 pe-1.5 text-muted'
  },
  variants: {
    /** A trailing control, such as the variable button, brings its own spacing after the unit. */
    suffix: {
      true: { display: 'pe-0', suffix: 'pe-0.5' },
      false: { display: 'pe-1.5' }
    }
  }
}

export type NumberFieldTheme = typeof numberFieldTheme
export default numberFieldTheme
