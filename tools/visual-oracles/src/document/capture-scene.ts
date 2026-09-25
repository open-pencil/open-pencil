import type { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

import type { SceneOracleNode } from './scene-oracle'

export function captureGraphOracle(
  graph: SceneGraph,
  rootId: string,
  sources: ReadonlyMap<string, string>
): SceneOracleNode[] {
  const sourceIds = new Map([...sources].map(([source, id]) => [id, source]))
  const nodes: SceneOracleNode[] = []
  const visit = (id: string, path: number[]): void => {
    const node = graph.getNode(id)
    if (!node) throw new Error(`Missing graph node ${id}`)
    const world = getWorldMatrix(node, graph)
    nodes.push({
      path,
      type: node.type,
      name: node.name,
      visible: node.visible,
      x: world[2],
      y: world[5],
      width: node.width,
      height: node.height,
      text: node.type === 'TEXT' ? node.text : null,
      main: node.type === 'INSTANCE' ? (sourceIds.get(node.componentId ?? '') ?? null) : null
    })
    graph.getChildren(id).forEach((child, index) => visit(child.id, [...path, index]))
  }
  visit(rootId, [])
  return nodes
}

export function figmaOracleScript(fileKey: string, rootId: string): string {
  return `
if (figma.fileKey !== ${JSON.stringify(fileKey)}) throw new Error('Wrong Figma document');
const root = await figma.getNodeByIdAsync(${JSON.stringify(rootId)});
if (!root) throw new Error('Missing Figma root');
figma.skipInvisibleInstanceChildren = false;
const nodes = [];
function visit(node, path) {
  nodes.push({path, type: node.type, name: node.name, visible: node.visible,
    x: node.absoluteTransform[0][2], y: node.absoluteTransform[1][2],
    width: node.width, height: node.height,
    text: node.type === 'TEXT' ? node.characters : null,
    main: node.type === 'INSTANCE' ? node.mainComponent?.id ?? null : null});
  if ('children' in node) node.children.forEach((child, index) => visit(child, [...path, index]));
}
visit(root, []);
return {fileKey: figma.fileKey, rootId: root.id, nodes};`
}
