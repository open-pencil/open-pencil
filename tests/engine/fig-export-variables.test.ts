import { describe, test, expect, beforeAll } from 'bun:test'

import {
  exportFigFile,
  parseFigFile,
  initCodec,
  SceneGraph,
} from '@open-pencil/core'

beforeAll(async () => {
  await initCodec()
})

describe('COLOR variable alpha handling', () => {
  test('COLOR variable without alpha exports successfully', async () => {
    const graph = new SceneGraph()
    const col = graph.createCollection('Colors')
    // Simulate a COLOR variable value missing the alpha field
    graph.createVariable('brand', 'COLOR', col.id, { r: 0.2, g: 0.4, b: 0.8 } as any)

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const vars = [...reimported.variables.values()]
    const colorVar = vars.find((v) => v.name === 'brand')!
    expect(colorVar.type).toBe('COLOR')
    const val = Object.values(colorVar.valuesByMode)[0] as { r: number; g: number; b: number; a: number }
    expect(val.r).toBeCloseTo(0.2, 1)
    expect(val.g).toBeCloseTo(0.4, 1)
    expect(val.b).toBeCloseTo(0.8, 1)
    expect(val.a).toBe(1)
  })

  test('COLOR variable with explicit alpha preserves it', async () => {
    const graph = new SceneGraph()
    const col = graph.createCollection('Colors')
    graph.createVariable('overlay', 'COLOR', col.id, { r: 0, g: 0, b: 0, a: 0.5 })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const vars = [...reimported.variables.values()]
    const colorVar = vars.find((v) => v.name === 'overlay')!
    const val = Object.values(colorVar.valuesByMode)[0] as { r: number; g: number; b: number; a: number }
    expect(val.a).toBeCloseTo(0.5, 1)
  })
})
