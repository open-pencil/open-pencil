import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'

type DerivedTextData = NonNullable<NodeChange['derivedTextData']>

interface DerivedTextDataOptions {
  node: SceneNode
  glyphs: DerivedTextData['glyphs']
  fontMetaData: DerivedTextData['fontMetaData']
  baselines: DerivedTextData['baselines']
  logicalIndexToCharacterOffsetMap: number[]
}

export function buildDerivedTextData(
  options: DerivedTextDataOptions
): NodeChange['derivedTextData'] {
  return {
    layoutSize: { x: options.node.width, y: options.node.height },
    baselines: options.baselines,
    glyphs: options.glyphs,
    fontMetaData: options.fontMetaData,
    logicalIndexToCharacterOffsetMap: options.logicalIndexToCharacterOffsetMap,
    derivedLines: [{ directionality: 'LTR' }],
    truncationStartIndex: -1,
    truncatedHeight: -1
  }
}
