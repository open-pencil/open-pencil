import { beforeAll, afterAll, describe, expect, test, spyOn, setDefaultTimeout } from 'bun:test'

import { unzipSync } from 'fflate'

import {
  exportFigFile,
  initCodec,
  isZstdCompressed,
  parseFigFile,
  parseFigKiwiChunks,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/core'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import {
  type Mismatch,
  type FixtureSpec,
  type CompareOptions,
  type Verifier,
  buildComponentPropertyDefinitionIndex,
  buildNodePathIndex,
  isColorObj,
  SCENE_VERIFIERS,
  RAW_VERIFIERS
} from './helpers'

let dateSpy: { mockRestore(): void } | undefined
setDefaultTimeout(180_000)
beforeAll(() => {
  dateSpy = spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-24T12:00:00.000Z')
})
afterAll(() => {
  dateSpy?.mockRestore()
})

const SKIP_KEYS = new Set(['id', 'parentId', 'childIds', 'componentId'])

function num3(n: number): string {
  return (Math.round(n * 1e4) / 1e4).toFixed(4)
}

const EPSILON = 0.01
const MAX_ERRORS = 2000

const SPECS: FixtureSpec[] = [
  {
    file: 'tests/fixtures/gold-preview.fig',
    fileSize: 550091,
    schemaSize: 25036,
    thumbnailSize: 23810,
    thumbnailWidth: 400,
    thumbnailHeight: 239,
    imageCount: 3,
    figKiwiVersion: 101
  }
]

function pngDimensions(png: Uint8Array): { w: number; h: number } {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { w: dv.getUint32(16), h: dv.getUint32(20) }
}

function buildPathMap(graph: SceneGraph): Map<string, SceneNode> {
  const map = new Map<string, SceneNode>()
  function walk(parentId: string, parentPath: string) {
    const children = graph.getChildren(parentId)
    for (let i = 0; i < children.length; i++) {
      const childPath = `${parentPath}/${i}`
      map.set(childPath, children[i])
      walk(children[i].id, childPath)
    }
  }
  for (const [p, page] of graph.getPages(true).entries()) {
    walk(page.id, `${p}`)
  }
  return map
}

// oxlint-disable-next-line eslint(complexity)
function deepCompare(
  a: unknown,
  b: unknown,
  key: string,
  path: string,
  opts: CompareOptions,
  depth = 0
): void {
  if (opts.errors.length >= MAX_ERRORS || depth > 20) return
  if (a === b) return
  if (a == null && b == null) return

  const leafKey = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key
  const vfn = opts.verifiers.get(key) ?? opts.verifiers.get(leafKey)
  if (vfn) {
    if (vfn({ a, b, key, path, ...opts })) return
    if (isColorObj(a) && isColorObj(b)) {
      opts.errors.push({
        path,
        key,
        message: `color(${num3(a.r)},${num3(a.g)},${num3(a.b)},${num3(a.a)}) -> color(${num3(b.r)},${num3(b.g)},${num3(b.b)},${num3(b.a)})`
      })
    } else {
      opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    }
    return
  }

  if (a == null || b == null) {
    opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) {
      opts.errors.push({ path, key, message: `bytes ${a.length} -> ${b.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        opts.errors.push({ path, key, message: `byte[${i}] differs (${a.length}B)` })
        return
      }
    }
    return
  }

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return
    if (Math.abs(a - b) > EPSILON) {
      opts.errors.push({ path, key, message: `${a} -> ${b} (D${+(b - a).toPrecision(4)})` })
    }
    return
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    opts.errors.push({ path, key, message: `kind mismatch` })
    return
  }

  if (Array.isArray(a)) {
    const ba = b as unknown[]
    if (a.length !== ba.length) {
      opts.errors.push({ path, key, message: `len ${a.length} -> ${ba.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      deepCompare(a[i], ba[i], `${key}[${i}]`, path, opts, depth + 1)
    }
    return
  }

  const allKeys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
  for (const k of allKeys) {
    if (depth === 0 && SKIP_KEYS.has(k)) continue
    deepCompare(
      (a as JSONObject)[k],
      (b as JSONObject)[k],
      key ? `${key}.${k}` : k,
      path,
      opts,
      depth + 1
    )
  }
}

function fmt(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  if (typeof v === 'string') return v.length > 50 ? `"${v.slice(0, 50)}..."` : `"${v}"`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Uint8Array) return `bytes[${v.length}]`
  if (Array.isArray(v)) return `[${v.length}]`
  return 'Object'
}

function summarize(errors: Mismatch[]): string {
  const buckets = new Map<string, string[]>()
  for (const err of errors) {
    const signature = `${err.key}: ${err.message}`
    let list = buckets.get(signature)
    if (!list) {
      list = []
      buckets.set(signature, list)
    }
    list.push(err.path)
  }

  const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)

  let out = `Found ${errors.length} mismatches across ${buckets.size} variants:\n\n`
  for (const [sig, paths] of sorted.slice(0, 20)) {
    out += `[${paths.length}x] ${sig}\n`
    out += `  Paths: ${paths.slice(0, 5).join(', ')}${paths.length > 5 ? ' ...' : ''}\n\n`
  }
  return out.trim()
}

function compareSceneProps(
  fixture: FixtureSpec,
  aGraph: SceneGraph,
  bGraph: SceneGraph,
  aNodes: Map<string, SceneNode>,
  bNodes: Map<string, SceneNode>,
  label: string,
  verifiers: Map<string, Verifier> = SCENE_VERIFIERS
): void {
  const errors: Mismatch[] = []
  const generation = label.startsWith('G1') ? 1 : 0
  const opts: CompareOptions = {
    aNodes,
    bNodes,
    aGraph,
    bGraph,
    aNodePaths: buildNodePathIndex(aNodes),
    bNodePaths: buildNodePathIndex(bNodes),
    aComponentPropertyDefinitions: buildComponentPropertyDefinitionIndex(aGraph),
    bComponentPropertyDefinitions: buildComponentPropertyDefinitionIndex(bGraph),
    errors,
    fixture,
    verifiers,
    label,
    generation
  }

  for (const [p, aNode] of aNodes) {
    const bNode = bNodes.get(p)
    if (!bNode) continue
    for (const k of new Set([...Object.keys(aNode as object), ...Object.keys(bNode as object)])) {
      if (SKIP_KEYS.has(k)) continue
      if (k === 'source') continue
      deepCompare((aNode as JSONObject)[k], (bNode as JSONObject)[k], k, p, opts)
    }
  }
  if (errors.length > 0) throw new Error(`${label} scene props:\n${summarize(errors)}`)
}

function compareRawNodeFields(
  fixture: FixtureSpec,
  aGraph: SceneGraph,
  bGraph: SceneGraph,
  aNodes: Map<string, SceneNode>,
  bNodes: Map<string, SceneNode>,
  label: string,
  verifiers: Map<string, Verifier> = RAW_VERIFIERS
): void {
  const errors: Mismatch[] = []
  const generation = label.startsWith('G1') ? 1 : 0
  const opts: CompareOptions = {
    aNodes,
    bNodes,
    aGraph,
    bGraph,
    aNodePaths: buildNodePathIndex(aNodes),
    bNodePaths: buildNodePathIndex(bNodes),
    aComponentPropertyDefinitions: buildComponentPropertyDefinitionIndex(aGraph),
    bComponentPropertyDefinitions: buildComponentPropertyDefinitionIndex(bGraph),
    errors,
    fixture,
    verifiers,
    label,
    generation
  }

  for (const [p, aNode] of aNodes) {
    const bNode = bNodes.get(p)
    if (!bNode) continue
    const aRaw = (aNode as JSONObject).source as JSONObject | undefined
    const bRaw = (bNode as JSONObject).source as JSONObject | undefined
    const aFig = aRaw?.fig as JSONObject | undefined
    const bFig = bRaw?.fig as JSONObject | undefined
    const aFields = aFig?.rawNodeFields as JSONObject | undefined
    const bFields = bFig?.rawNodeFields as JSONObject | undefined
    if (!aFields && !bFields) continue
    deepCompareRaw(aFields, bFields, '', p, opts)
  }
  if (errors.length > 0) throw new Error(`${label} rawNodeFields:\n${summarize(errors)}`)
}

// oxlint-disable-next-line eslint(complexity)
function deepCompareRaw(
  a: unknown,
  b: unknown,
  key: string,
  path: string,
  opts: CompareOptions,
  depth = 0
): void {
  if (opts.errors.length >= MAX_ERRORS || depth > 20) return
  if (a === b) return
  if (a == null && b == null) return

  if (typeof key === 'string' && key !== '') {
    const leafKey = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key
    const vfn = opts.verifiers.get(key) ?? opts.verifiers.get(leafKey)
    if (vfn) {
      if (vfn({ a, b, key, path, ...opts })) return
    }
  }

  if (
    key === '' &&
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null &&
    !Array.isArray(a)
  ) {
    const aObj = a as JSONObject
    const bObj = b as JSONObject
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
    for (const k of allKeys) {
      const vfn2 = opts.verifiers.get(k)
      if (vfn2) {
        if (!vfn2({ a: aObj[k], b: bObj[k], key: k, path, ...opts })) {
          opts.errors.push({
            path,
            key: k,
            message: `verifier rejected (${fmt(aObj[k])} -> ${fmt(bObj[k])})`
          })
        }
      } else {
        deepCompareRaw(aObj[k], bObj[k], k, path, opts, depth + 1)
      }
    }
    return
  }

  if (a == null || b == null) {
    opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) {
      opts.errors.push({ path, key, message: `bytes ${a.length} -> ${b.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        opts.errors.push({ path, key, message: `byte[${i}]` })
        return
      }
    }
    return
  }

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return
    if (Math.abs(a - b) > EPSILON) opts.errors.push({ path, key, message: `${a} -> ${b}` })
    return
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) opts.errors.push({ path, key, message: `${fmt(a)} -> ${fmt(b)}` })
    return
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    opts.errors.push({ path, key, message: `kind` })
    return
  }

  if (Array.isArray(a)) {
    const ba = b as unknown[]
    if (a.length !== ba.length) {
      opts.errors.push({ path, key, message: `len ${a.length}->${ba.length}` })
      return
    }
    for (let i = 0; i < a.length; i++) {
      deepCompareRaw(a[i], ba[i], `${key}[${i}]`, path, opts, depth + 1)
    }
    return
  }

  const aObj = a as JSONObject
  const bObj = b as JSONObject
  const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
  for (const k of allKeys) {
    const fullKey = key ? `${key}.${k}` : k
    const vfn2 = opts.verifiers.get(fullKey) ?? opts.verifiers.get(k)
    if (vfn2) {
      if (!vfn2({ a: aObj[k], b: bObj[k], key: fullKey, path, ...opts })) {
        opts.errors.push({
          path,
          key: fullKey,
          message: `verifier rejected (${fmt(aObj[k])} -> ${fmt(bObj[k])})`
        })
      }
    } else {
      deepCompareRaw(aObj[k], bObj[k], fullKey, path, opts, depth + 1)
    }
  }
}

function verifyFixture(spec: FixtureSpec): void {
  const name = (spec.file.split('/').pop() ?? '').replace('.fig', '')

  describe(`roundtrip: ${name}`, () => {
    let g0!: Map<string, SceneNode>
    let g0Graph!: SceneGraph
    let g0Bytes!: ArrayBuffer
    let g0Zip!: Record<string, Uint8Array>
    let g0Chunks!: Uint8Array[]
    let g1!: Map<string, SceneNode>
    let g1Graph!: SceneGraph
    let g1Export!: Uint8Array
    let g2!: Map<string, SceneNode>
    let g2Export!: Uint8Array
    let g2Graph!: SceneGraph

    const g0Ready = (async () => {
      await initCodec()
      g0Bytes = await Bun.file(spec.file).arrayBuffer()
      g0Zip = unzipSync(new Uint8Array(g0Bytes))
      const chunks = parseFigKiwiChunks(g0Zip['canvas.fig'])
      if (!chunks) throw new Error('canvas.fig chunks not found')
      g0Chunks = chunks
      g0Graph = await parseFigFile(g0Bytes)
      g0 = buildPathMap(g0Graph)
    })()

    let g1Ready: Promise<void> | null = null
    function ensureG1(): Promise<void> {
      if (!g1Ready) {
        g1Ready = (async () => {
          await g0Ready
          g1Export = await exportFigFile(g0Graph)
          g1Graph = await parseFigFile(g1Export.buffer as ArrayBuffer)
          g1 = buildPathMap(g1Graph)
        })()
      }
      return g1Ready
    }

    let g2Ready: Promise<void> | null = null
    function ensureG2(): Promise<void> {
      if (!g2Ready) {
        g2Ready = (async () => {
          await ensureG1()
          g2Export = await exportFigFile(g1Graph)
          g2Graph = await parseFigFile(g2Export.buffer as ArrayBuffer)
          g2 = buildPathMap(g2Graph)
        })()
      }
      return g2Ready
    }

    test('original file size', async () => {
      await g0Ready
      expect(g0Bytes.byteLength).toBe(spec.fileSize)
    })

    test('original ZIP structure', async () => {
      await g0Ready
      const entries = Object.keys(g0Zip)
      expect(entries).toContain('canvas.fig')
      expect(entries).toContain('thumbnail.png')
      expect(entries).toContain('meta.json')
      const imageEntries = entries.filter((n) => n.startsWith('images/') && n.length > 7)
      expect(imageEntries.length).toBe(spec.imageCount)
    })

    test('original thumbnail dimensions', async () => {
      await g0Ready
      const thumb = g0Zip['thumbnail.png']
      expect(thumb.byteLength).toBe(spec.thumbnailSize)
      const { w, h } = pngDimensions(thumb)
      expect(w).toBe(spec.thumbnailWidth)
      expect(h).toBe(spec.thumbnailHeight)
    })

    test('original fig-kiwi container', async () => {
      await g0Ready
      const canvas = g0Zip['canvas.fig']
      const dv = new DataView(canvas.buffer, canvas.byteOffset, canvas.byteLength)
      expect(dv.getUint32(8, true)).toBe(spec.figKiwiVersion)
      expect(g0Chunks[0].byteLength).toBe(spec.schemaSize)
      expect(isZstdCompressed(g0Chunks[1])).toBe(true)
    })

    test('G0 is one connected tree with unique child ownership', async () => {
      await g0Ready
      const visited = new Set<string>()
      const pending = [g0Graph.rootId]
      while (pending.length) {
        const id = pending.pop()
        if (!id) throw new Error('Missing traversal ID')
        expect(visited.has(id), `duplicate or cyclic child ${id}`).toBe(false)
        visited.add(id)
        const node = g0Graph.getNode(id)
        if (!node) throw new Error(`Missing graph node ${id}`)
        for (const childId of node.childIds) {
          expect(g0Graph.getNode(childId)?.parentId).toBe(node.id)
          pending.push(childId)
        }
      }
      expect(visited.size).toBe(g0Graph.nodes.size)
      expect(g0.size).toBeGreaterThan(0)
    })

    test('G0 instances reference real component definitions', async () => {
      await g0Ready
      const instances = [...g0.values()].filter((node) => node.type === 'INSTANCE')
      expect(instances.length).toBeGreaterThan(0)
      for (const instance of instances) {
        expect(instance.componentId).not.toBeNull()
        expect(g0Graph.getNode(instance.componentId ?? '')?.type).toBe('COMPONENT')
      }
    })

    test('G0->G1 schema bytes identical', async () => {
      await ensureG1()
      const g1Chunks = parseFigKiwiChunks(unzipSync(g1Export)['canvas.fig'])
      if (!g1Chunks) throw new Error('G1 canvas.fig chunks not found')
      expect(g1Chunks[0].byteLength).toBe(g0Chunks[0].byteLength)
    })

    test('G1 unedited export preserves the original archive bytes', async () => {
      await ensureG1()
      expect(g1Export).toEqual(new Uint8Array(g0Bytes))
    })

    test('G2 unedited export remains byte-identical', async () => {
      await ensureG2()
      expect(g2Export).toEqual(g1Export)
    })

    test('edited export re-encodes the document without mutating unloaded source pages', async () => {
      await g0Ready
      const edited = await parseFigFile(g0Bytes.slice(0), { populate: 'first-page' })
      const page = edited.getPages()[0]
      const name = `${page.name} (edited)`
      edited.updateNode(page.id, { name })
      const before = structuredClone([...edited.nodes])
      const bytes = await exportFigFile(edited)
      expect(bytes).not.toEqual(new Uint8Array(g0Bytes))
      expect([...edited.nodes]).toEqual(before)
      const reopened = await parseFigFile(bytes.slice().buffer as ArrayBuffer)
      expect(reopened.getPages()[0].name).toBe(name)
      expect(reopened.figSchemaDeflated).toEqual(edited.figSchemaDeflated)
      // Unreferenced internal style definitions are outside the reader's reachable closure.
      const visibleCount = (nodes: Map<string, SceneNode>) =>
        [...nodes.values()].filter((node) => !node.sharedStyleType).length
      expect(visibleCount(buildPathMap(reopened))).toBe(visibleCount(g0))
    })

    test('G0->G1 node count', async () => {
      await ensureG1()
      expect(g1.size, `G0=${g0.size} G1=${g1.size}`).toBe(g0.size)
    })

    test('G0->G1 tree paths', async () => {
      await ensureG1()
      const missing = [...g0.keys()].filter((p) => !g1.has(p))
      const extra = [...g1.keys()].filter((p) => !g0.has(p))
      const parts: string[] = []
      if (missing.length) parts.push(`Missing in G1:\n${missing.slice(0, 30).join('\n')}`)
      if (extra.length) parts.push(`Extra in G1:\n${extra.slice(0, 30).join('\n')}`)
      expect(missing.length + extra.length, parts.join('\n\n')).toBe(0)
    })

    test('G0->G1 node types', async () => {
      await ensureG1()
      const bad: string[] = []
      for (const [p, n0] of g0) {
        const n1 = g1.get(p)
        if (n1 && n0.type !== n1.type) bad.push(`${p}: ${n0.type}->${n1.type}`)
      }
      expect(bad.length, bad.join('\n')).toBe(0)
    })

    test('G0->G1 scene props', async () => {
      await ensureG1()
      compareSceneProps(spec, g0Graph, g1Graph, g0, g1, 'G0->G1')
    })

    test('G0->G1 rawNodeFields', async () => {
      await ensureG1()
      compareRawNodeFields(spec, g0Graph, g1Graph, g0, g1, 'G0->G1')
    })

    test('G1->G2 idempotent node count', async () => {
      await ensureG2()
      expect(g2.size, `G1=${g1.size} G2=${g2.size}`).toBe(g1.size)
    })

    test('G1->G2 idempotent paths', async () => {
      await ensureG2()
      const missing = [...g1.keys()].filter((p) => !g2.has(p))
      const extra = [...g2.keys()].filter((p) => !g1.has(p))
      const parts: string[] = []
      if (missing.length) parts.push(`Missing in G2:\n${missing.slice(0, 30).join('\n')}`)
      if (extra.length) parts.push(`Extra in G2:\n${extra.slice(0, 30).join('\n')}`)
      expect(missing.length + extra.length, parts.join('\n\n')).toBe(0)
    })

    test('G1->G2 idempotent scene props', async () => {
      await ensureG2()
      compareSceneProps(spec, g1Graph, g2Graph, g1, g2, 'G1->G2')
    })

    test('G1->G2 idempotent rawNodeFields', async () => {
      await ensureG2()
      compareRawNodeFields(spec, g1Graph, g2Graph, g1, g2, 'G1->G2')
    })
  })
}

for (const spec of SPECS) {
  verifyFixture(spec)
}
