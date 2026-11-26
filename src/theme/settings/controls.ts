/**
 * Every select in a settings row is this wide, full width when a narrow window stacks the row,
 * so the controls of a page line up. A plain string, so it can be forwarded to child UI props.
 */
export const SETTINGS_SELECT_WIDTH = 'w-full sm:w-52'

/** The `ui` an `AppSelect` in a settings row takes. */
export const settingsSelectUI = { trigger: SETTINGS_SELECT_WIDTH } as const
