import { bench, group, run } from 'mitata'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { parseFigFile, exportFigFile, initCodec, SceneGraph } from '@open-pencil/core'
import { copyFills } from '../../packages/core/src/copy'

const FIXTURES = resolve(import.meta.dir, '../fixtures')

const goldBuf = readFileSync(resolve(FIXTURES, 'gold-preview.fig'))
const materialBuf = readFileSync(resolve(FIXTURES, 'material3.fig'))

await initCodec()

group('parseFigFile', () => {
  bench('gold-preview.fig (537K)', async () => {
    await parseFigFile(goldBuf.buffer.slice(0) as ArrayBuffer)
  })

  bench('material3.fig (55M)', async () => {
    await parseFigFile(materialBuf.buffer.slice(0) as ArrayBuffer)
  })
})

const goldGraph = await parseFigFile(goldBuf.buffer.slice(0) as ArrayBuffer)
const materialGraph = await parseFigFile(materialBuf.buffer.slice(0) as ArrayBuffer)

group('exportFigFile', () => {
  bench('gold-preview', async () => {
    await exportFigFile(goldGraph)
  })

  bench('material3', async () => {
    await exportFigFile(materialGraph)
  })
})

group('SceneGraph operations', () => {
  bench('getAllNodes (material3)', () => {
    const nodes = [...materialGraph.getAllNodes()]
    void nodes.length
  })

  const sampleIds = [...materialGraph.getAllNodes()].slice(0, 1000).map((n) => n.id)
  bench('getNode × 1000 (material3)', () => {
    for (const id of sampleIds) materialGraph.getNode(id)
  })

  bench('createNode + deleteNode × 100', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const ids: string[] = []
    for (let i = 0; i < 100; i++) {
      const node = graph.createNode('RECTANGLE', page.id, {
        name: `R${i}`,
        width: 50,
        height: 50
      })
      ids.push(node.id)
    }
    for (const id of ids) graph.deleteNode(id)
  })
})

group('SceneNode memory', () => {
  bench('create 10k nodes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    for (let i = 0; i < 10_000; i++) {
      graph.createNode('RECTANGLE', page.id, {
        name: `R${i}`,
        width: 50,
        height: 50
      })
    }
  })
})

group('structuredClone vs copy (fills)', () => {
  const sampleFills = [
    { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' as const },
    { type: 'SOLID' as const, color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 0.5, visible: true, blendMode: 'NORMAL' as const }
  ]

  bench('structuredClone × 10k', () => {
    for (let i = 0; i < 10_000; i++) structuredClone(sampleFills)
  })

  bench('copyFills × 10k', () => {
    for (let i = 0; i < 10_000; i++) copyFills(sampleFills)
  })
})

await run()
