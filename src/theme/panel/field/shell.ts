import { panelFieldBase } from './base'

/**
 * A panel field that shows a value without editing it as a number: Auto in a gap field, a typed
 * scale, a slot's state. Its leading, value, and trailing parts line up with a number field's,
 * so a trailing menu sits on the same 20px rhythm.
 */
const panelFieldShellTheme = {
  slots: {
    root: [panelFieldBase, 'flex items-center overflow-hidden text-2xs'],
    leading:
      'flex shrink-0 items-center justify-center self-stretch px-1.25 text-muted select-none [&>*]:pointer-events-none',
    value: 'flex min-w-0 flex-1 items-center gap-1.5 truncate text-surface',
    trailing: 'flex shrink-0 items-center self-stretch pe-0.5'
  },
  variants: {
    /** Without a leading icon the value keeps the field's inner padding. */
    leading: {
      true: {},
      false: { value: 'ps-1.5' }
    },
    /** Without a trailing control the value keeps the field's inner padding. */
    trailing: {
      true: {},
      false: { value: 'pe-1.5' }
    }
  }
}

export type PanelFieldShellTheme = typeof panelFieldShellTheme
export default panelFieldShellTheme
