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
}

export interface SceneOracleDifference {
  path: number[]
  category: 'structure' | 'semantic' | 'visible-geometry' | 'hidden-geometry'
  field: string
  expected: unknown
  actual: unknown
}

/** Compare complete ordered trees. Rounded rectangles share Figma's RECTANGLE type. */
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
  const hidden = (node: SceneOracleNode, nodes: Map<string, SceneOracleNode>): boolean => {
    for (let depth = 0; depth <= node.path.length; depth++) {
      if (nodes.get(JSON.stringify(node.path.slice(0, depth)))?.visible === false) return true
    }
    return false
  }
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
    const push = (
      field: string,
      category: SceneOracleDifference['category'],
      expected: unknown,
      actual: unknown
    ) => {
      differences.push({ path: a.path, field, category, expected, actual })
    }
    for (const field of ['type', 'name', 'visible', 'text', 'main'] as const) {
      const normalize = (value: unknown) =>
        field === 'type' && value === 'ROUNDED_RECTANGLE' ? 'RECTANGLE' : value
      if (normalize(a[field]) !== normalize(b[field])) push(field, 'semantic', a[field], b[field])
    }
    const category = hidden(a, left) && hidden(b, right) ? 'hidden-geometry' : 'visible-geometry'
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
  return differences
}
