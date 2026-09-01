import type { SceneGraph } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/fonts'
import { collectGraphFontRequirements, collectNodeFontFaces } from '#core/text/requirements'
import { missingGraphFontScripts } from '#core/text/resolved-requirements'

import { documentFontStatus, type DocumentFontStatus } from './font/status'

export async function prepareGraphFonts(
  graph: SceneGraph,
  nodeIds: readonly string[]
): Promise<DocumentFontStatus> {
  const requirements = collectGraphFontRequirements(graph, nodeIds)
  const faces = requirements.nodes.flatMap(collectNodeFontFaces)
  await Promise.all(
    faces.map(({ family, style }) => fontManager.loadFont(family, style, requirements.characters))
  )
  await fontManager.ensureFallbackPack(
    missingGraphFontScripts(requirements),
    requirements.characters
  )
  return documentFontStatus(graph, nodeIds)
}
