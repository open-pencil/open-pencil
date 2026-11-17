import { SETTINGS_SELECT_WIDTH } from '../settings/controls'

/**
 * Control widths are plain strings so they can be forwarded to child UI props. The field sits in
 * settings rows, so its select is as wide as theirs.
 */
export const presetNumberSizes = {
  select: SETTINGS_SELECT_WIDTH,
  field: 'w-full sm:w-32'
} as const

const presetNumberTheme = {
  slots: {
    root: 'flex flex-col gap-1',
    row: 'flex flex-wrap items-center gap-2',
    error: 'text-xs text-error'
  }
} as const

export type PresetNumberTheme = typeof presetNumberTheme

export default presetNumberTheme
