import {
  defineMode,
  defineVars,
  designMode,
  type DesignMode,
  type DesignVariable
} from '@open-pencil/design-jsx'

/**
 * The tour's colors live in two collections, each with a Dark and a Light mode: Theme, for the
 * tour's own design, and App chrome, for the pieces of OpenPencil's interface the tips draw.
 * The app picks the mode that matches its own theme when it opens the tour, by these
 * collection and mode names, and paints the page in the Theme's Page color
 * (`src/app/demo/theme.ts`).
 */
export const COLLECTION_NAMES = { theme: 'Theme', chrome: 'App chrome' } as const
export const MODE_NAMES = { dark: 'Dark', light: 'Light' } as const

type Mode = keyof typeof MODE_NAMES
type Entry = readonly [key: string, name: string, dark: string | number, light: string | number]

const THEME_COLORS = [
  ['page', 'Page', '#0E0E12', '#ECECF1'],
  ['section', 'Section', '#131319', '#F7F7FA'],
  ['numeral', 'Text/Numeral', '#64647E', '#8B8BA0'],
  ['surface', 'Surface', '#1A1A20', '#FFFFFF'],
  ['raised', 'Surface/Raised', '#26262E', '#EDEDF2'],
  ['line', 'Line', '#33333D', '#DCDCE4'],
  ['text', 'Text', '#F5F5F7', '#141418'],
  ['muted', 'Text/Muted', '#9B9BAA', '#62627A'],
  ['faint', 'Text/Faint', '#4A4A58', '#C9C9D4'],
  ['accent', 'Accent', '#7C3AED', '#6D28D9'],
  ['onAccent', 'Accent/Text', '#FFFFFF', '#FFFFFF']
] as const satisfies readonly Entry[]

/** The page background the file is saved with: the Page color in the default, Dark mode. */
export const PAGE_BACKGROUND = THEME_COLORS[0][2]

const THEME_NUMBERS = [
  ['radius', 'Radius', 24, 20],
  ['cornerRadius', 'Radius/Control', 12, 10]
] as const satisfies readonly Entry[]

/** OpenPencil's own interface colors, from `src/app.css`, dark and light. */
const CHROME_COLORS = [
  ['panel', 'Panel', '#2A2A2A', '#FFFFFF'],
  ['header', 'Header', '#1E1E1E', '#F3F4F6'],
  ['field', 'Field', '#383838', '#F0F1F3'],
  ['border', 'Border', '#3A3A3A', '#D8DCE3'],
  ['text', 'Text', '#E6E6E6', '#1F2328'],
  ['muted', 'Text/Muted', '#A6A6A6', '#5F6673'],
  ['blue', 'Accent', '#2563EB', '#2563EB'],
  ['onBlue', 'Accent/Text', '#FFFFFF', '#FFFFFF'],
  ['previewChip', 'Preview/Chip', '#293246', '#DBE7FB'],
  ['previewText', 'Preview/Text', '#5A9AEA', '#1D4ED8'],
  ['component', 'Component', '#A78BFA', '#7C3AED'],
  ['slot', 'Slot', '#F472B6', '#DB2777'],
  ['checker', 'Checkerboard', '#4A4A4A', '#D8DCE3']
] as const satisfies readonly Entry[]

type Vars<T extends readonly Entry[]> = Record<T[number][0], DesignVariable>

/**
 * A collection with a Dark and a Light mode, Dark the default, and its variables by their keys.
 * A render that binds any of them adds the collection to the file.
 */
function defineCollection(name: string, entries: readonly Entry[]) {
  const named = defineVars(
    name,
    Object.fromEntries(entries.map(([, variableName, dark]) => [variableName, dark])),
    { mode: MODE_NAMES.dark }
  )
  const light = defineMode(
    named,
    MODE_NAMES.light,
    Object.fromEntries(entries.map(([, variableName, , value]) => [variableName, value]))
  )
  const vars: Record<string, DesignVariable> = Object.fromEntries(
    entries.map(([key, variableName]) => [key, named[variableName]])
  )
  return { vars, modes: { dark: designMode(name, MODE_NAMES.dark), light } }
}

/** The tour's collections, with references to every variable in them. */
export function createTheme() {
  const theme = defineCollection(COLLECTION_NAMES.theme, [...THEME_COLORS, ...THEME_NUMBERS])
  const chrome = defineCollection(COLLECTION_NAMES.chrome, CHROME_COLORS)
  return {
    vars: theme.vars as Vars<typeof THEME_COLORS> & Vars<typeof THEME_NUMBERS>,
    chrome: chrome.vars as Vars<typeof CHROME_COLORS>,
    /** The Theme collection's modes, for frames that pin one. */
    modes: theme.modes satisfies Record<Mode, DesignMode>
  }
}

export type Theme = ReturnType<typeof createTheme>
