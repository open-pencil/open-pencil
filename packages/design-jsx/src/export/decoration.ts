import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'

import { TEXT_DECORATION_STYLE } from '../enums'
import { AUTO, CURRENT_COLOR } from '../overrides/text'
import { paintPropValue } from './paints'
import type { JSXProp } from './value'

type DecorationStyle = Pick<
  CharacterStyleOverride,
  | 'textDecorationStyle'
  | 'textDecorationFills'
  | 'textDecorationThickness'
  | 'textUnderlineOffset'
  | 'textDecorationSkipInk'
>

/**
 * The decoration details set in `style`, as `<Text>` and `<Span>` write them. A decoration
 * painted with more than one paint keeps only its first, the one `textDecorationColor` holds.
 */
export function collectDecorationProps(
  style: DecorationStyle,
  node: SceneNode,
  props: JSXProp[]
): void {
  const { textDecorationFills: fills } = style
  if (style.textDecorationStyle !== undefined)
    props.push(['textDecorationStyle', TEXT_DECORATION_STYLE.print(style.textDecorationStyle)])
  if (fills) {
    const fill = fills.at(0)
    props.push(['textDecorationColor', fill ? paintPropValue(fill, node) : CURRENT_COLOR])
  }
  if (style.textDecorationThickness !== undefined)
    props.push(['textDecorationThickness', style.textDecorationThickness ?? AUTO])
  if (style.textUnderlineOffset !== undefined)
    props.push(['textUnderlineOffset', style.textUnderlineOffset ?? AUTO])
  if (style.textDecorationSkipInk !== undefined)
    props.push(['textDecorationSkipInk', style.textDecorationSkipInk])
}
