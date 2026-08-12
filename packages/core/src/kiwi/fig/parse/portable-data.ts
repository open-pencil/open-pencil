import type {
  DocumentColorSpace,
  SceneNode,
  Variable,
  VariableCollection
} from '@open-pencil/scene-graph'

export interface PortableSceneGraphData {
  rootId: string
  nodes: Array<[string, SceneNode]>
  images: Array<[string, Uint8Array]>
  variables: Array<[string, Variable]>
  variableCollections: Array<[string, VariableCollection]>
  activeMode: Array<[string, string]>
  documentColorSpace: DocumentColorSpace
}
