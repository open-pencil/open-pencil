import { beforeAll, afterAll, expect, test, spyOn, setDefaultTimeout } from 'bun:test'

import {
  expectSaveLoadedOnlyInternalPages,
  snapshotNodes
} from '#core-tests/helpers/fig/save-contract'
import { unzipSync } from 'fflate'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { isZstdCompressed } from '@open-pencil/kiwi/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { parseFigKiwiChunks } from '@open-pencil/kiwi/fig/container'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { imageSize } from '@open-pencil/scene-graph/images'
import { heavy } from '@open-pencil/test-support/heavy'

import { buildPathMap, compareRawNodeFields, compareSceneProps } from './compare'
import type { FixtureSpec } from './helpers'

let dateSpy: { mockRestore(): void } | undefined
setDefaultTimeout(180_000)
beforeAll(() => {
  dateSpy = spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-24T12:00:00.000Z')
})
afterAll(() => {
  dateSpy?.mockRestore()
})

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

function verifyFixture(spec: FixtureSpec): void {
  const name = (spec.file.split('/').pop() ?? '').replace('.fig', '')

  heavy(`roundtrip: ${name}`, () => {
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
      expect(imageSize(thumb)).toEqual({ width: spec.thumbnailWidth, height: spec.thumbnailHeight })
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

    test('edited export re-encodes the document without loading unloaded visible pages', async () => {
      await g0Ready
      const edited = await parseFigFile(g0Bytes.slice(0), { populate: 'first-page' })
      const page = edited.getPages()[0]
      const name = `${page.name} (edited)`
      edited.updateNode(page.id, { name })
      const before = snapshotNodes(edited)
      const bytes = await exportFigFile(edited)
      expect(bytes).not.toEqual(new Uint8Array(g0Bytes))
      expectSaveLoadedOnlyInternalPages(edited, before)
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
      compareSceneProps({
        fixture: spec,
        aGraph: g0Graph,
        bGraph: g1Graph,
        aNodes: g0,
        bNodes: g1,
        label: 'G0->G1'
      })
    })

    test('G0->G1 rawNodeFields', async () => {
      await ensureG1()
      compareRawNodeFields({
        fixture: spec,
        aGraph: g0Graph,
        bGraph: g1Graph,
        aNodes: g0,
        bNodes: g1,
        label: 'G0->G1'
      })
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
      compareSceneProps({
        fixture: spec,
        aGraph: g1Graph,
        bGraph: g2Graph,
        aNodes: g1,
        bNodes: g2,
        label: 'G1->G2'
      })
    })

    test('G1->G2 idempotent rawNodeFields', async () => {
      await ensureG2()
      compareRawNodeFields({
        fixture: spec,
        aGraph: g1Graph,
        bGraph: g2Graph,
        aNodes: g1,
        bNodes: g2,
        label: 'G1->G2'
      })
    })
  })
}

for (const spec of SPECS) {
  verifyFixture(spec)
}
