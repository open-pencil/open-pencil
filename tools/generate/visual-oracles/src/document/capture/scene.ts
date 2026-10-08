import type { Color, Fill, SceneGraph, Stroke } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

import type { SceneOracleNode } from '../scene-oracle'

/**
 * Drawing takes a solid paint's alpha from its opacity, so that is the transparency a
 * capture has to record; Figma reports the same number the same way.
 */
function solid(color: Color, opacity: number): string {
  const rgb = [color.r, color.g, color.b].map((value) => Math.round(value * 255)).join(',')
  return `SOLID ${rgb} ${Math.round(opacity * 100)}%`
}

function fillPaints(fills: readonly Fill[]): string[] {
  return fills
    .filter((fill) => fill.visible !== false)
    .map((fill) => (fill.type === 'SOLID' ? solid(fill.color, fill.opacity) : fill.type))
}

/** A Scene Graph stroke is always one solid color; Figma reports it as a SOLID paint. */
function strokePaints(strokes: readonly Stroke[]): string[] {
  return strokes
    .filter((stroke) => stroke.visible !== false)
    .map((stroke) => solid(stroke.color, stroke.opacity))
}

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
      main: node.type === 'INSTANCE' ? (sourceIds.get(node.componentId ?? '') ?? null) : null,
      fills: fillPaints(node.fills),
      strokes: strokePaints(node.strokes)
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
function paints(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((paint) => paint.visible !== false).map((paint) => {
    if (paint.type !== 'SOLID') return paint.type;
    const rgb = [paint.color.r, paint.color.g, paint.color.b].map((v) => Math.round(v * 255)).join(',');
    return 'SOLID ' + rgb + ' ' + Math.round((paint.opacity ?? 1) * 100) + '%';
  });
}
function visit(node, path) {
  nodes.push({path, type: node.type, name: node.name, visible: node.visible,
    x: node.absoluteTransform[0][2], y: node.absoluteTransform[1][2],
    width: node.width, height: node.height,
    text: node.type === 'TEXT' ? node.characters : null,
    main: node.type === 'INSTANCE' ? node.mainComponent?.id ?? null : null,
    fills: paints(node.fills), strokes: paints(node.strokes)});
  if ('children' in node) node.children.forEach((child, index) => visit(child, [...path, index]));
}
visit(root, []);
return {fileKey: figma.fileKey, rootId: root.id, nodes};`
}
