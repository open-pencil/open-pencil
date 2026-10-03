import { renderTree } from '@open-pencil/core/design-jsx'
import { Text } from '@open-pencil/design-jsx'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

interface TypographySample {
  name: string
  text: string
  font?: string
  fontFeatures?: SceneNode['fontFeatures']
  decoration?: Pick<
    SceneNode,
    'textDecoration' | 'textDecorationStyle' | 'textDecorationFills' | 'textDecorationThickness'
  >
}

/** These native OpenType/decoration fields are not Design JSX shorthands. */
export async function createTypographySample(
  graph: SceneGraph,
  parentId: string,
  sample: TypographySample
) {
  const result = await renderTree(
    graph,
    Text({
      name: sample.name,
      children: sample.text,
      font: sample.font ?? 'Inter',
      size: 24,
      lineHeight: 36,
      w: 'fill',
      color: '#172554'
    }),
    { parentId }
  )
  graph.updateNode(result.id, {
    fontFeatures: sample.fontFeatures ?? [],
    ...sample.decoration
  })
  return result.id
}
