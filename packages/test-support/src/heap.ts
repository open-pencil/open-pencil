import * as v from 'valibot'

/** A V8-format heap snapshot, as `Bun.generateHeapSnapshot('v8')` writes it. */
const heapSnapshotSchema = v.object({
  snapshot: v.object({
    meta: v.object({
      node_fields: v.array(v.string()),
      node_types: v.tupleWithRest([v.array(v.string())], v.unknown()),
      edge_fields: v.array(v.string()),
      edge_types: v.tupleWithRest([v.array(v.string())], v.unknown())
    })
  }),
  nodes: v.array(v.number()),
  edges: v.array(v.number()),
  strings: v.array(v.string())
})

/** References an object holds on its own: its properties, elements, and closures' variables. */
const HELD_EDGES = new Set(['property', 'element', 'context', 'internal'])

/**
 * What an internal reference leads to that every object reaches, and so says nothing about what
 * it holds: shapes and their prototypes, code, and the scopes of modules and of the global object.
 */
const SHARED_TYPES = new Set(['object shape', 'code'])
const SHARED_NAMES = new Set([
  'GlobalObject',
  'system / JSModuleEnvironment',
  'system / JSGlobalLexicalEnvironment'
])

/**
 * Which of the classes named in `classes` have an instance that an instance of the class named
 * `from` holds through its own references: properties, elements, and the variables its closures
 * capture, but not its prototype, its code, or module and global scopes, which reach everything.
 *
 * It asks what references what, which never depends on when the collector runs: a test that
 * something was let go asserts nothing holds it, rather than waiting for `Bun.gc` to collect it,
 * which a stray pointer on the stack can delay at random. A snapshot of a large heap takes
 * seconds, so a test that calls it takes a longer timeout (`HEAVY_TEST_TIMEOUT_MS`).
 */
export function heldInstances(from: string, classes: readonly string[]): Set<string> {
  const snapshot = v.parse(
    v.pipe(v.string(), v.parseJson(), heapSnapshotSchema),
    Bun.generateHeapSnapshot('v8')
  )
  const { meta } = snapshot.snapshot
  const { nodes, edges, strings } = snapshot
  const nodeSize = meta.node_fields.length
  const edgeSize = meta.edge_fields.length
  const nodeType = meta.node_fields.indexOf('type')
  const nodeName = meta.node_fields.indexOf('name')
  const edgeCount = meta.node_fields.indexOf('edge_count')
  const edgeType = meta.edge_fields.indexOf('type')
  const edgeTarget = meta.edge_fields.indexOf('to_node')
  const [nodeTypes] = meta.node_types
  const [edgeTypes] = meta.edge_types

  const typeOf = (node: number) => nodeTypes[nodes[node + nodeType] ?? -1]
  const nameOf = (node: number) => strings[nodes[node + nodeName] ?? -1]
  const isInstance = (node: number, className: string) =>
    typeOf(node) === 'object' && nameOf(node) === className
  const isShared = (node: number) =>
    SHARED_TYPES.has(typeOf(node) ?? '') || SHARED_NAMES.has(nameOf(node) ?? '')

  // Each node's edges follow those of the nodes before it.
  const firstEdge = new Map<number, number>()
  const queue: number[] = []
  let edge = 0
  for (let node = 0; node < nodes.length; node += nodeSize) {
    firstEdge.set(node, edge)
    edge += (nodes[node + edgeCount] ?? 0) * edgeSize
    if (isInstance(node, from)) queue.push(node)
  }

  const held = new Set<string>()
  const seen = new Set(queue)
  // An array's iterator reaches what is pushed while it runs, and never shifts the queue.
  for (const next of queue) {
    const name = nameOf(next)
    if (name && typeOf(next) === 'object' && classes.includes(name)) held.add(name)
    const start = firstEdge.get(next) ?? 0
    for (let index = 0; index < (nodes[next + edgeCount] ?? 0); index++) {
      const offset = start + index * edgeSize
      const target = edges[offset + edgeTarget]
      if (target === undefined || seen.has(target)) continue
      if (!HELD_EDGES.has(edgeTypes[edges[offset + edgeType] ?? -1] ?? '') || isShared(target)) {
        continue
      }
      seen.add(target)
      queue.push(target)
    }
  }
  return held
}
