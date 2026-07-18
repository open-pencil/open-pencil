import { panelFieldBase } from './panel/field'

const numberFieldTheme = {
  slots: {
    root: [
      panelFieldBase,
      'group flex min-h-6 flex-1 cursor-ew-resize items-center text-[11px] tabular-nums data-[disabled]:cursor-auto data-[editing]:cursor-auto'
    ],
    leading:
      'flex shrink-0 items-center justify-center self-stretch px-[5px] text-muted select-none [&>*]:pointer-events-none',
    field:
      'min-w-0 flex-1 cursor-text border-none bg-transparent pr-1.5 font-[inherit] text-[11px] text-surface outline-none',
    display: 'flex flex-1 items-center truncate overflow-hidden text-[11px] select-none',
    mixed: 'flex-1 text-muted',
    value: 'flex-1 text-surface',
    suffix: 'shrink-0 pr-1.5 text-muted'
  },
  variants: {
    suffix: {
      true: { display: 'pr-0' },
      false: { display: 'pr-1.5' }
    }
  }
}

export type NumberFieldTheme = typeof numberFieldTheme
export default numberFieldTheme
