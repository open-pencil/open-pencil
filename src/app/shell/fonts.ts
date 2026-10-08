/** The Inter weights the interface draws with, declared with `@font-face` in `app.css`. */
const INTERFACE_FONT_WEIGHTS = [400, 500, 600, 700] as const

/**
 * Loads the interface's fonts. The app mounts only after they are in, so nothing is ever drawn in
 * a fallback font and swapped.
 */
export async function loadInterfaceFonts(): Promise<void> {
  await Promise.all(
    INTERFACE_FONT_WEIGHTS.map((weight) => document.fonts.load(`${weight} 13px Inter`))
  )
}
