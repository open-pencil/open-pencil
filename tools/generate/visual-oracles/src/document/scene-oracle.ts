import * as v from 'valibot'

export interface SceneOracleNode {
  path: number[]
  type: string
  name: string
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  text: string | null
  main: string | null
  /** Visible paints as `TYPE r,g,b a%`, so a transparency difference is legible. */
  fills: string[]
  strokes: string[]
}

/** One node of a scene oracle, as captures and baseline files store it. */
export const SceneOracleNodeSchema: v.GenericSchema<unknown, SceneOracleNode> = v.object({
  path: v.array(v.number()),
  type: v.string(),
  name: v.string(),
  visible: v.boolean(),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  text: v.nullable(v.string()),
  main: v.nullable(v.string()),
  fills: v.array(v.string()),
  strokes: v.array(v.string())
})

export interface SceneOracleDifference {
  path: number[]
  category:
    | 'structure'
    | 'semantic'
    | 'visible-geometry'
    | 'hidden-geometry'
    | 'visible-paint'
    | 'hidden-paint'
  field: string
  expected: unknown
  actual: unknown
}

type Push = (
  field: string,
  category: SceneOracleDifference['category'],
  expected: unknown,
  actual: unknown
) => void

/** A layer nobody sees, either because it is hidden or because an ancestor is. */
function hidden(node: SceneOracleNode, nodes: ReadonlyMap<string, SceneOracleNode>): boolean {
  for (let depth = 0; depth <= node.path.length; depth++) {
    if (nodes.get(JSON.stringify(node.path.slice(0, depth)))?.visible === false) return true
  }
  return false
}

/** Rounded rectangles share Figma's RECTANGLE type. */
function compareIdentity(a: SceneOracleNode, b: SceneOracleNode, push: Push): void {
  for (const field of ['type', 'name', 'visible', 'text', 'main'] as const) {
    const normalize = (value: unknown) =>
      field === 'type' && value === 'ROUNDED_RECTANGLE' ? 'RECTANGLE' : value
    if (normalize(a[field]) !== normalize(b[field])) push(field, 'semantic', a[field], b[field])
  }
}

function comparePaint(a: SceneOracleNode, b: SceneOracleNode, isHidden: boolean, push: Push): void {
  for (const field of ['fills', 'strokes'] as const) {
    if (a[field].join(' | ') !== b[field].join(' | '))
      push(field, isHidden ? 'hidden-paint' : 'visible-paint', a[field], b[field])
  }
}

function compareGeometry(
  a: SceneOracleNode,
  b: SceneOracleNode,
  isHidden: boolean,
  tolerance: number,
  push: Push
): void {
  const category = isHidden ? 'hidden-geometry' : 'visible-geometry'
  for (const field of ['x', 'y', 'width', 'height'] as const) {
    if (
      !Number.isFinite(a[field]) ||
      !Number.isFinite(b[field]) ||
      Math.abs(a[field] - b[field]) > tolerance
    ) {
      push(field, category, a[field], b[field])
    }
  }
}

/** Compare complete ordered trees. */
export function compareSceneOracle(
  expected: readonly SceneOracleNode[],
  actual: readonly SceneOracleNode[],
  tolerance = 0.01
): SceneOracleDifference[] {
  const index = (nodes: readonly SceneOracleNode[]) => {
    const result = new Map<string, SceneOracleNode>()
    for (const node of nodes) {
      const key = JSON.stringify(node.path)
      if (result.has(key)) throw new Error(`Duplicate occurrence path ${key}`)
      result.set(key, node)
    }
    return result
  }
  const left = index(expected)
  const right = index(actual)
  const differences: SceneOracleDifference[] = []
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(key)
    const b = right.get(key)
    if (!a || !b) {
      differences.push({
        path: (a ?? b)?.path ?? [],
        category: 'structure',
        field: 'node',
        expected: a ?? null,
        actual: b ?? null
      })
      continue
    }
    const push: Push = (field, category, expected, actual) => {
      differences.push({ path: a.path, field, category, expected, actual })
    }
    const isHidden = hidden(a, left) && hidden(b, right)
    compareIdentity(a, b, push)
    comparePaint(a, b, isHidden, push)
    compareGeometry(a, b, isHidden, tolerance, push)
  }
  return differences
}
