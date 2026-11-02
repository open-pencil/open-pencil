import { createTextRule } from './support.ts'

/**
 * A Tailwind utility with a pixel length in its arbitrary value, such as `text-[11px]`, `h-[26px]`
 * or `grid-cols-[24px_1fr]`. Shadows keep pixel offsets: they are decoration, not layout.
 */
const PX_UTILITY =
  /(?<![\w[-])-?(?!shadow)[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-\[[^\]\s"'`]*\dpx[^\]\s"'`]*\]/g

export interface PxUtility {
  utility: string
  line: number
  column: number
}

/** Pixel-sized Tailwind utilities in the app's and the Vue SDK's sources. */
export function pxUtilities(sourceRel: string, content: string): PxUtility[] {
  if (!sourceRel.startsWith('src/') && !sourceRel.startsWith('packages/vue/src/')) return []
  const found: PxUtility[] = []
  for (const [index, text] of content.split('\n').entries()) {
    for (const match of text.matchAll(PX_UTILITY)) {
      found.push({ utility: match[0], line: index + 1, column: match.index + 1 })
    }
  }
  return found
}

export const noPxTailwindValues = createTextRule(
  'open-pencil/no-px-tailwind-values',
  (sourceRel, content) =>
    pxUtilities(sourceRel, content).map(({ utility, line, column }) => ({
      message: `Size the interface in rem so it follows the root font size: replace ${utility} with a theme size (text-2xs, h-6.5, rounded-md) or a rem value.`,
      line,
      column
    }))
)
