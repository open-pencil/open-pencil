import { tv } from 'tailwind-variants'

import type { Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import fillSwatchTriggerTheme from '@/theme/paint/swatch-trigger'

export const fillSwatchTrigger = tv(fillSwatchTriggerTheme)

/** The fill a swatch draws for a plain colour, such as a page background or an effect's. */
export function solidFill(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}
