import type { Editor } from '@open-pencil/core/editor'
import type { NumericNodeProperty, SceneNode } from '@open-pencil/scene-graph'

import { useNodePreview } from '#vue/controls/node-preview/use'

export function usePropScrub(editor: Editor) {
  const preview = useNodePreview(editor)

  function updateProp(nodes: SceneNode[], key: NumericNodeProperty, value: number) {
    preview.update(
      nodes.map((node) => node.id),
      { [key]: value },
      `Change ${key}`
    )
  }

  function commitProp(
    _nodes: SceneNode[],
    _key: NumericNodeProperty,
    _value: number,
    _previous: number
  ) {
    preview.commit()
  }

  function cancelProp(_nodes: SceneNode[], _key: NumericNodeProperty) {
    preview.cancel()
  }

  return { updateProp, commitProp, cancelProp }
}
