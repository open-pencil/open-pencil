import type { VariableCollection } from '@open-pencil/scene-graph'

/** The modes a new collection starts with: Light, its default, and Dark. */
export const THEME_MODE_NAMES = { light: 'Light', dark: 'Dark' } as const

/**
 * Where Dark applies in CSS: under the `dark` class, as Tailwind's and shadcn/ui's dark mode
 * switch it; Light, the default, applies at `:root`.
 */
export const DARK_MODE_CONDITION = '.dark'

/** A new collection's modes and default, as code built from the design expects a theme. */
export function themeModes(): Pick<VariableCollection, 'modes' | 'defaultModeId'> {
  return {
    modes: [
      { modeId: 'light', name: THEME_MODE_NAMES.light },
      { modeId: 'dark', name: THEME_MODE_NAMES.dark, condition: DARK_MODE_CONDITION }
    ],
    defaultModeId: 'light'
  }
}
