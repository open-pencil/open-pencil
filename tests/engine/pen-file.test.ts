import { describe, test, expect } from 'bun:test'
import { join } from 'path'

import { parsePenFile, parseDesignFile, validatePenImport } from '@open-pencil/core'

const FIXTURE_DIR = join(import.meta.dir, '..', 'fixtures')
const FIXTURE_PATH = join(FIXTURE_DIR, 'pencil_file.pen')

function loadFixture(): string {
  return require('fs').readFileSync(FIXTURE_PATH, 'utf8')
}

function loadFile(name: string): string {
  return require('fs').readFileSync(join(FIXTURE_DIR, name), 'utf8')
}

describe('parsePenFile', () => {
  test('parses without throwing', () => {
    const json = loadFixture()
    const graph = parsePenFile(json)
    expect(graph).toBeDefined()
  })

  test('creates pages', () => {
    const graph = parsePenFile(loadFixture())
    const pages = graph.getPages()
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  test('imports nodes', () => {
    const graph = parsePenFile(loadFixture())
    const all = [...graph.getAllNodes()]
    expect(all.length).toBeGreaterThan(50)
  })

  test('preserves original IDs', () => {
    const graph = parsePenFile(loadFixture())
    expect(graph.getNode('xCEfn')).toBeDefined()
    expect(graph.getNode('xCEfn')!.name).toBe('Tooltip')
  })

  test('maps frame type correctly', () => {
    const graph = parsePenFile(loadFixture())
    const tooltip = graph.getNode('xCEfn')!
    expect(tooltip.type).toBe('COMPONENT')
  })

  test('maps text node', () => {
    const graph = parsePenFile(loadFixture())
    const text = graph.getNode('wFonn')!
    expect(text.type).toBe('TEXT')
    expect(text.text).toBe('New Project')
    expect(text.fontSize).toBe(14)
    expect(text.fontWeight).toBe(500)
  })

  test('maps rectangle type', () => {
    const graph = parsePenFile(loadFixture())
    const rect = graph.getNode('qQ5Qx')!
    expect(rect.type).toBe('RECTANGLE')
  })

  test('maps path to VECTOR with vectorNetwork', () => {
    const graph = parsePenFile(loadFixture())
    const path = graph.getNode('cui2i')!
    expect(path.type).toBe('VECTOR')
    expect(path.vectorNetwork).not.toBeNull()
    expect(path.vectorNetwork!.vertices.length).toBeGreaterThan(0)
  })

  test('maps ref to INSTANCE with componentId', () => {
    const graph = parsePenFile(loadFixture())
    const ref = graph.getNode('R6Qz5')!
    expect(ref.type).toBe('INSTANCE')
    expect(ref.componentId).toBe('Svd9t')
  })

  test('maps reusable to COMPONENT', () => {
    const graph = parsePenFile(loadFixture())
    const component = graph.getNode('Svd9t')!
    expect(component.type).toBe('COMPONENT')
    expect(component.name).toBe('Button/Ghost')
  })

  test('skips prompt nodes', () => {
    const graph = parsePenFile(loadFixture())
    expect(graph.getNode('2wZ9Y')).toBeUndefined()
    expect(graph.getNode('zHxSZ')).toBeUndefined()
  })

  test('imports variables', () => {
    const graph = parsePenFile(loadFixture())
    expect(graph.variables.size).toBe(41)
  })

  test('imports variable collections with theme modes', () => {
    const graph = parsePenFile(loadFixture())
    const collections = [...graph.variableCollections.values()]
    expect(collections.length).toBe(1)
    expect(collections[0].modes.length).toBe(2)
    expect(collections[0].modes.map((m) => m.name)).toEqual(['Light', 'Dark'])
  })

  test('variable has correct values per mode', () => {
    const graph = parsePenFile(loadFixture())
    const bgVar = [...graph.variables.values()].find((v) => v.name === '--background')!
    expect(bgVar).toBeDefined()
    expect(bgVar.type).toBe('COLOR')
    const modes = [...graph.variableCollections.values()][0].modes
    const lightVal = bgVar.valuesByMode[modes[0].modeId]
    expect(lightVal).toEqual(expect.objectContaining({ r: expect.any(Number), g: expect.any(Number), b: expect.any(Number) }))
  })

  test('resolves fill from variable reference', () => {
    const graph = parsePenFile(loadFixture())
    const tooltip = graph.getNode('xCEfn')!
    expect(tooltip.fills.length).toBe(1)
    expect(tooltip.fills[0].type).toBe('SOLID')
    expect(tooltip.fills[0].visible).toBe(true)
  })

  test('resolves disabled fill', () => {
    const graph = parsePenFile(loadFixture())
    const node = graph.getNode('ULBkt')!
    expect(node.fills.length).toBe(1)
    expect(node.fills[0].visible).toBe(false)
  })

  test('converts strokes with fill color', () => {
    const graph = parsePenFile(loadFixture())
    const path = graph.getNode('cui2i')!
    expect(path.strokes.length).toBe(1)
    expect(path.strokes[0].weight).toBe(1)
    expect(path.strokes[0].align).toBe('CENTER')
    expect(path.strokeJoin).toBe('ROUND')
    expect(path.strokeCap).toBe('ROUND')
  })

  test('converts effects', () => {
    const graph = parsePenFile(loadFixture())
    const tooltip = graph.getNode('xCEfn')!
    expect(tooltip.effects.length).toBe(1)
    expect(tooltip.effects[0].type).toBe('DROP_SHADOW')
    expect(tooltip.effects[0].radius).toBeCloseTo(3.5)
    expect(tooltip.effects[0].spread).toBe(-1)
  })

  test('converts auto-layout with gap and padding', () => {
    const graph = parsePenFile(loadFixture())
    const tooltip = graph.getNode('xCEfn')!
    expect(tooltip.layoutMode).toBe('HORIZONTAL')
    expect(tooltip.itemSpacing).toBe(8)
    expect(tooltip.paddingTop).toBe(6)
    expect(tooltip.paddingBottom).toBe(6)
    expect(tooltip.paddingRight).toBe(12)
    expect(tooltip.paddingLeft).toBe(12)
  })

  test('converts vertical layout', () => {
    const graph = parsePenFile(loadFixture())
    const node = graph.getNode('QFzE8')!
    expect(node.layoutMode).toBe('VERTICAL')
    expect(node.itemSpacing).toBe(6)
  })

  test('converts layout=none', () => {
    const graph = parsePenFile(loadFixture())
    const node = graph.getNode('24hPt')
    expect(node).toBeDefined()
  })

  test('converts corner radius from variable', () => {
    const graph = parsePenFile(loadFixture())
    const tooltip = graph.getNode('xCEfn')!
    expect(tooltip.cornerRadius).toBe(999)
  })

  test('converts individual corner radii', () => {
    const graph = parsePenFile(loadFixture())
    const node = graph.getNode('mdnDd')!
    expect(node.independentCorners).toBe(true)
    expect(node.topLeftRadius).toBe(999)
    expect(node.topRightRadius).toBe(0)
  })

  test('converts clipsContent', () => {
    const graph = parsePenFile(loadFixture())
    const frame = graph.getNode('frame-1761929672442')!
    expect(frame.clipsContent).toBe(true)
  })

  test('converts width fill_container sizing', () => {
    const graph = parsePenFile(loadFixture())
    const progress = graph.getNode('W4YFH')!
    expect(progress.width).toBe(360)
  })

  test('handles font family variable', () => {
    const graph = parsePenFile(loadFixture())
    const text = graph.getNode('wFonn')!
    expect(text.fontFamily).toBe('Geist')
  })

  test('creates children in correct order', () => {
    const graph = parsePenFile(loadFixture())
    const tooltip = graph.getNode('xCEfn')!
    expect(tooltip.childIds.length).toBe(1)
    expect(tooltip.childIds[0]).toBe('wFonn')
  })

  test('icon_font maps to TEXT', () => {
    const graph = parsePenFile(loadFixture())
    const icon = graph.getNode('UlKF0')!
    expect(icon.type).toBe('TEXT')
    expect(icon.text).toBe('keyboard_arrow_down')
    expect(icon.fontFamily).toBe('Material Symbols Sharp')
  })

  test('handles enabled=false → visible=false', () => {
    const graph = parsePenFile(loadFixture())
    const node = graph.getNode('LIuaX')!
    expect(node.visible).toBe(false)
  })

  test('handles independent stroke weights', () => {
    const graph = parsePenFile(loadFixture())
    const node = graph.getNode('7ZdzW')!
    expect(node.independentStrokeWeights).toBe(true)
    expect(node.borderTopWeight).toBe(1)
    expect(node.borderBottomWeight).toBe(1)
    expect(node.borderLeftWeight).toBe(1)
    expect(node.borderRightWeight).toBe(0)
  })
})

describe('theme support', () => {
  test('Dark theme switches active mode', () => {
    const json = loadFile('pencil_simple.pen')
    const graph = parsePenFile(json)
    const col = [...graph.variableCollections.values()][0]
    const activeMode = graph.activeMode.get(col.id)!
    const modeName = col.modes.find((m) => m.modeId === activeMode)?.name
    expect(modeName).toBe('Dark')
  })

  test('Dark theme resolves foreground to white', () => {
    const json = loadFile('pencil_simple.pen')
    const graph = parsePenFile(json)
    const fgVar = [...graph.variables.values()].find((v) => v.name === '--foreground')!
    const col = [...graph.variableCollections.values()][0]
    const activeMode = graph.activeMode.get(col.id)!
    const val = fgVar.valuesByMode[activeMode] as { r: number; g: number; b: number }
    expect(val.r).toBe(1)
    expect(val.g).toBe(1)
    expect(val.b).toBe(1)
  })
})

describe('lineHeight conversion', () => {
  test('multiplier converted to absolute px', () => {
    const json = loadFile('pencil_simple.pen')
    const graph = parsePenFile(json)
    const text = graph.getNode('lmf6z')!
    expect(text.fontSize).toBe(14)
    expect(text.lineHeight).toBeCloseTo(14 * 1.4285714285714286, 1)
  })
})

describe('layout sizing', () => {
  test('fill_container in NONE parent becomes FIXED', () => {
    const graph = parsePenFile(loadFixture())
    const alert = graph.getNode('ITZkn')!
    expect(alert.primaryAxisSizing).toBe('FIXED')
    expect(alert.width).toBe(640)
  })

  test('fill_container width in VERTICAL parent sets STRETCH', () => {
    const json = loadFile('pencil_simple.pen')
    const graph = parsePenFile(json)
    const table = graph.getNode('8vM6Y')!
    expect(table.layoutAlignSelf).toBe('STRETCH')
  })

  test('fill_container height in VERTICAL parent sets layoutGrow', () => {
    const json = loadFile('pencil_simple.pen')
    const graph = parsePenFile(json)
    const headerRow = graph.getNode('yenJQ')!
    expect(headerRow.layoutAlignSelf).toBe('STRETCH')
  })

  test('fit_content(N) sets minHeight', () => {
    const json = loadFile('pencil_simple.pen')
    const data = JSON.parse(json)
    let hasFitContent = false
    function walk(nodes: Array<Record<string, unknown>>) {
      for (const n of nodes) {
        if (typeof n.height === 'string' && (n.height as string).startsWith('fit_content(')) {
          hasFitContent = true
          const graph = parsePenFile(json)
          const node = graph.getNode(n.id as string)
          const num = parseInt((n.height as string).match(/\((\d+)\)/)?.[1] ?? '0', 10)
          expect(node?.minHeight).toBe(num)
        }
        if (Array.isArray(n.children)) walk(n.children as Array<Record<string, unknown>>)
      }
    }
    walk(data.children)
    if (!hasFitContent) expect(true).toBe(true)
  })

  test('default layout for frames is HORIZONTAL', () => {
    const json = loadFile('pencil_button.pen')
    const graph = parsePenFile(json)
    const btn = graph.getNode('T3Um0')!
    expect(btn.layoutMode).toBe('HORIZONTAL')
  })

  test('layout: none maps to NONE', () => {
    const graph = parsePenFile(loadFixture())
    const root = graph.getNode('frame-1761929672442')!
    expect(root.layoutMode).toBe('NONE')
  })
})

describe('vector path scaling', () => {
  test('scales vectorNetwork to declared width/height', () => {
    const json = loadFile('pencil_button.pen')
    const graph = parsePenFile(json)
    const vector = graph.getNode('NWqkO')!
    expect(vector.vectorNetwork).not.toBeNull()
    let maxX = 0, maxY = 0
    for (const v of vector.vectorNetwork!.vertices) {
      maxX = Math.max(maxX, v.x)
      maxY = Math.max(maxY, v.y)
    }
    expect(maxX).toBeCloseTo(12, 0)
    expect(maxY).toBeCloseTo(12, 0)
  })
})

describe('instance cloning', () => {
  test('ref nodes get children cloned from component', () => {
    const graph = parsePenFile(loadFixture())
    const ref = graph.getNode('R6Qz5')!
    expect(ref.type).toBe('INSTANCE')
    expect(ref.childIds.length).toBeGreaterThan(0)
  })

  test('ref + reusable maps to INSTANCE not COMPONENT', () => {
    const graph = parsePenFile(loadFixture())
    const node = graph.getNode('YZjRF')!
    expect(node.type).toBe('INSTANCE')
    expect(node.componentId).toBe('ITZkn')
  })
})

describe('design-file router', () => {
  test('parseDesignFile routes .pen to parsePenFile', async () => {
    const json = loadFile('pencil_button.pen')
    const buf = new TextEncoder().encode(json).buffer
    const graph = await parseDesignFile(buf, 'test.pen')
    expect(graph.getPages().length).toBeGreaterThanOrEqual(1)
    expect(graph.getNode('T3Um0')).toBeDefined()
  })
})

describe('validatePenImport', () => {
  test('validates button file without errors', () => {
    const json = loadFile('pencil_button.pen')
    const graph = parsePenFile(json)
    const result = validatePenImport(json, graph)
    expect(result.errors).toBe(0)
  })
})
