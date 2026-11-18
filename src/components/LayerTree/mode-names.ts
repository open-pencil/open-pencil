import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  appliedVariableModes,
  type AppliedVariableMode,
  type NumberedCollectionFormat
} from '@open-pencil/vue/controls/variable-modes'

/** The variable modes set on a layer itself, tagged after its name as in Figma. */
export function layerAppliedModes(
  graph: SceneGraph,
  variableModes: Readonly<Record<string, string>> | undefined,
  numbered: NumberedCollectionFormat
): AppliedVariableMode[] {
  return variableModes ? appliedVariableModes(graph, variableModes, numbered) : []
}
