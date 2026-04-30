import type { NodeChange } from '#core/kiwi/binary/codec'
import type { SceneNode } from '#core/scene-graph'

interface DerivedTextDataOptions {
  node: SceneNode
  glyphs: NonNullable<NodeChange['derivedTextData']>['glyphs']
  fontMetaData: NonNullable<NodeChange['derivedTextData']>['fontMetaData']
  baseline: number
  width: number
  lineHeight: number
  lineAscent: number
  logicalIndexToCharacterOffsetMap: number[]
}

export function buildDerivedTextData(
  options: DerivedTextDataOptions
): NodeChange['derivedTextData'] {
  return {
    layoutSize: { x: options.node.width, y: options.node.height },
    baselines: [
      {
        firstCharacter: 0,
        endCharacter: Math.max(options.node.text.length - 1, 0),
        position: { x: 0, y: options.baseline },
        width: options.width,
        lineHeight: options.lineHeight,
        lineAscent: options.lineAscent
      }
    ],
    glyphs: options.glyphs,
    fontMetaData: options.fontMetaData,
    logicalIndexToCharacterOffsetMap: options.logicalIndexToCharacterOffsetMap,
    derivedLines: [{ directionality: 'LTR' }],
    truncationStartIndex: -1,
    truncatedHeight: -1
  }
}
