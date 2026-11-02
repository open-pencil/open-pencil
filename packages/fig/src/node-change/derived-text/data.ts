import type { NodeChange } from '@lawha/kiwi/fig/codec'
import type { SceneNode } from '@lawha/scene-graph'

type DerivedTextData = NonNullable<NodeChange['derivedTextData']>

interface DerivedTextDataOptions {
  node: SceneNode
  glyphs: DerivedTextData['glyphs']
  decorations?: DerivedTextData['decorations']
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
    ...(options.decorations ? { decorations: options.decorations } : {}),
    fontMetaData: options.fontMetaData,
    logicalIndexToCharacterOffsetMap: options.logicalIndexToCharacterOffsetMap,
    derivedLines: [{ directionality: 'LTR' }],
    truncationStartIndex: -1,
    truncatedHeight: -1
  }
}
