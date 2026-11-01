import type { SceneNode } from '@open-pencil/scene-graph'
import {
  figJamTextSize,
  figJamTextSizeFields,
  figJamTypeface,
  figJamTypefaceFields,
  type FigJamTextSize,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'

import { FIGJAM_TEXT_SIZE, FIGJAM_TYPEFACE } from '../enums'

/**
 * The fields a sticky note's body or a shape's label takes from `textSize` and `typeface`, as
 * FigJam's text menus set them; the typeface keeps the size the text ends up at.
 */
export function figJamTextFields(
  text: Pick<SceneNode, 'fontSize'>,
  textSize: FigJamTextSize | undefined,
  typeface: FigJamTypeface | undefined
): Partial<SceneNode> {
  const sized = textSize ? figJamTextSizeFields(textSize, typeface) : {}
  if (!typeface) return sized
  return figJamTypefaceFields(typeface, { fontSize: sized.fontSize ?? text.fontSize })
}

/** `textSize` and `typeface` as an element writes them, each left out at FigJam's default. */
export function figJamTextProps(
  text: Pick<SceneNode, 'fontSize' | 'fontFamily'>
): Array<[string, string]> {
  const props: Array<[string, string]> = []
  const size = figJamTextSize(text)
  if (size !== 'small') props.push(['textSize', FIGJAM_TEXT_SIZE.print(size)])
  const typeface = figJamTypeface(text)
  if (typeface && typeface !== 'simple') props.push(['typeface', FIGJAM_TYPEFACE.print(typeface)])
  return props
}
