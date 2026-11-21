import type { CompactVector, CompactVectorPath } from '#design-json/compact/types'

import type { GeometryPath, SceneNode, WindingRule } from '@open-pencil/scene-graph'
import { GeometryCommand, readGeometryBlob } from '@open-pencil/scene-graph/geometry'
import type { VectorPathWindingRule } from '@open-pencil/scene-graph/parse-path'
import { outlineSVGPath } from '@open-pencil/scene-graph/paths'
import { polygonOutline } from '@open-pencil/scene-graph/polygon'
import { vectorNetworkPaths } from '@open-pencil/scene-graph/vector-network'

const DECIMALS = 3

const FILL_RULES: Record<VectorPathWindingRule, CompactVectorPath['fillRule']> = {
  NONZERO: 'nonzero',
  EVENODD: 'evenodd',
  NONE: 'none'
}

const LETTERS: Record<GeometryCommand, string> = {
  [GeometryCommand.CLOSE]: 'Z',
  [GeometryCommand.MOVE]: 'M',
  [GeometryCommand.LINE]: 'L',
  [GeometryCommand.QUAD]: 'Q',
  [GeometryCommand.CUBIC]: 'C'
}

/**
 * The shape a vector layer draws, as SVG path data in its own coordinates, from 0,0 to its width
 * and height. Taken from the first source the layer has: its vector network, the geometry a
 * `.fig` file saved, or the outline its type implies. Undefined when none gives a path.
 */
export function describeVector(node: SceneNode): CompactVector | undefined {
  const paths = vectorPaths(node)
  if (paths.length === 0) return undefined
  return { width: node.width, height: node.height, paths }
}

function vectorPaths(node: SceneNode): CompactVectorPath[] {
  if (node.vectorNetwork) return networkPaths(node)
  if (node.fillGeometry.length > 0) return node.fillGeometry.map(geometryPath)
  return outlinePaths(node)
}

function networkPaths(node: SceneNode): CompactVectorPath[] {
  if (!node.vectorNetwork) return []
  return vectorNetworkPaths(node.vectorNetwork).map((path) => ({
    d: roundPathData(path.data),
    fillRule: FILL_RULES[path.windingRule]
  }))
}

function geometryPath(geometry: GeometryPath): CompactVectorPath {
  return {
    d: geometryBlobPathData(geometry.commandsBlob),
    fillRule: fillRuleOf(geometry.windingRule)
  }
}

function fillRuleOf(windingRule: WindingRule): CompactVectorPath['fillRule'] {
  return FILL_RULES[windingRule]
}

/** The outline of a star, a polygon, or a line, which keep no path of their own. */
function outlinePaths(node: SceneNode): CompactVectorPath[] {
  if (node.type === 'STAR' || node.type === 'POLYGON') {
    return [{ d: outlineSVGPath(polygonOutline(node), round), fillRule: 'nonzero' }]
  }
  if (node.type === 'LINE') return [{ d: `M0 0L${round(node.width)} 0`, fillRule: 'none' }]
  return []
}

function geometryBlobPathData(blob: Uint8Array): string {
  const parts: string[] = []
  readGeometryBlob(blob, (command, coords) => {
    parts.push(`${LETTERS[command]}${coords.map(round).join(' ')}`)
  })
  return parts.join('')
}

/** Path data written at full precision, with each number rounded. */
function roundPathData(data: string): string {
  return data.replace(/-?\d*\.\d+(?:e-?\d+)?/gi, (value) => String(round(Number(value))))
}

function round(value: number): number {
  const factor = 10 ** DECIMALS
  return Math.round(value * factor) / factor
}
