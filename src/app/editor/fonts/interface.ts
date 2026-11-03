import interVariableItalic from '@open-pencil/core/assets/InterVariable-Italic.ttf?url'
import interVariable from '@open-pencil/core/assets/InterVariable.ttf?url'

/** The interface's font, as `app.css` names it, and the weights its variable files cover. */
const INTERFACE_FONT_FAMILY = 'Inter'
const INTERFACE_FONT_WEIGHTS = '100 900'

/**
 * The interface is set in Inter. Its variable files are registered for the page at start, for
 * every weight, so Home and every panel draw in Inter's own weights on any system, whether Inter
 * is installed or not and before a canvas loads the font for its own text. Kept apart from
 * `index.ts` because `?url` imports only resolve in a Vite build, not in the Bun test runner.
 */
export function registerInterfaceFont(): void {
  if (typeof document === 'undefined') return
  for (const [url, style] of [
    [interVariable, 'normal'],
    [interVariableItalic, 'italic']
  ] as const) {
    document.fonts.add(
      new FontFace(INTERFACE_FONT_FAMILY, `url(${url})`, { weight: INTERFACE_FONT_WEIGHTS, style })
    )
  }
}
