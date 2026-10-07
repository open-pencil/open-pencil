import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FileSystemIconLoader } from 'unplugin-icons/loaders'

/**
 * Monochrome provider and agent logos from LobeHub, used as `<icon-ai-openai />` or
 * `~icons/ai/openai`. They draw with `currentColor` on a 24px grid, like Lucide.
 */
export function aiIconCollection() {
  const manifest = fileURLToPath(import.meta.resolve('@lobehub/icons-static-svg/package.json'))
  const icons = join(dirname(manifest), 'icons')
  // Titles would add tooltips and duplicate the accessible name of the label beside the logo.
  return FileSystemIconLoader(icons, (svg) => svg.replace(/<title>.*?<\/title>/, ''))
}
