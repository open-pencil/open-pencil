import { tv } from 'tailwind-variants'

/** Control widths are plain strings so they can be forwarded to child UI props. */
export const presetNumberSizes = {
  select: 'w-full sm:w-44',
  field: 'w-full sm:w-32'
} as const

const presetNumberTheme = {
  slots: {
    root: 'flex flex-col gap-1',
    row: 'flex flex-wrap items-center gap-2',
    error: 'text-xs text-error'
  }
} as const

export const presetNumber = tv(presetNumberTheme)

export type PresetNumberTheme = typeof presetNumberTheme

export default presetNumberTheme
