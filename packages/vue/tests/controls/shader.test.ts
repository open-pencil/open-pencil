import { describe, expect, test } from 'bun:test'

import {
  addShaderEffect,
  loadShaderCatalog,
  moveShaderEffect,
  parseShaderPreset,
  removeShaderEffect,
  seedStops,
  setShaderEffectProp,
  shaderPresetJSON,
  shaderStops,
  fillStops,
  stopsFill
} from '#vue/controls/shader'

const PRESET = { components: [{ type: 'Aurora' }, { type: 'FilmGrain' }] }

describe('shader presets', () => {
  test('stack effects: added on top, moved, removed down to the last one', () => {
    const added = addShaderEffect(PRESET, 'Swirl')
    expect(added.components.map((c) => c.type)).toEqual(['Aurora', 'FilmGrain', 'Swirl'])

    const moved = moveShaderEffect(added, 2, 0)
    expect(moved.components.map((c) => c.type)).toEqual(['Swirl', 'Aurora', 'FilmGrain'])
    expect(moveShaderEffect(added, 0, 5)).toBe(added)

    const one = removeShaderEffect(removeShaderEffect(PRESET, 0), 0)
    expect(one.components.map((c) => c.type)).toEqual(['FilmGrain'])
  })

  test('sets one prop of one effect', () => {
    const next = setShaderEffectProp(PRESET, 1, 'strength', 0.4)
    expect(next.components).toEqual([
      { type: 'Aurora' },
      { type: 'FilmGrain', props: { strength: 0.4 } }
    ])
    expect(PRESET.components[1]).toEqual({ type: 'FilmGrain' })
  })

  test('reads a preset from JSON and rejects anything else', () => {
    expect(parseShaderPreset(shaderPresetJSON(PRESET))).toEqual(PRESET)
    expect(parseShaderPreset('{"components":[]}')).toBeNull()
    expect(parseShaderPreset('not json')).toBeNull()
  })
})

describe('shader catalog', () => {
  test('describes each effect with controls for its props', async () => {
    const catalog = await loadShaderCatalog()
    const aurora = catalog.find((effect) => effect.name === 'Aurora')

    expect(catalog.length).toBeGreaterThan(100)
    expect(aurora?.props.find((prop) => prop.key === 'colorA')).toMatchObject({
      kind: 'color',
      label: 'Color A',
      default: '#a533f8'
    })
    expect(aurora?.props.find((prop) => prop.key === 'curtainCount')).toMatchObject({
      kind: 'range',
      min: 1,
      max: 4,
      step: 1
    })
    expect(aurora?.props.find((prop) => prop.key === 'center')).toMatchObject({ kind: 'position' })
  })
})

describe('shader color stops', () => {
  test('a gradient-stops prop is edited as stops, others the library leaves to the JSON', async () => {
    const catalog = await loadShaderCatalog()
    const mesh = catalog.find((effect) => effect.name === 'MeshGradient')
    expect(mesh?.props.find((prop) => prop.key === 'stops')).toMatchObject({ kind: 'stops' })
    const glass = catalog.find((effect) => effect.name === 'Glass')
    expect(glass?.props.find((prop) => prop.key === 'shape')).toMatchObject({ kind: 'other' })
  })

  test('stops round-trip through the gradient fill the editor edits, in the editor’s order', () => {
    const stops = [
      { color: '#7c3aed', position: 0.6 },
      { color: '#0f0f13', position: 0 },
      { color: '#e879f980', position: 1 }
    ]
    const fill = stopsFill(stops)
    expect(fill.type).toBe('GRADIENT_LINEAR')
    expect(fill.gradientStops?.[2]?.color.a).toBeCloseTo(0.5, 2)
    expect(fillStops(fill)).toEqual(stops)
  })

  test('a prop holds stops only as two or more color stops; new ones start from the colors', () => {
    expect(shaderStops(null)).toBeNull()
    expect(shaderStops([{ color: '#000000', position: 0 }])).toBeNull()
    expect(shaderStops('#fff')).toBeNull()
    expect(seedStops(['#ff0000', '#00ff00', '#0000ff'])).toEqual([
      { color: '#ff0000', position: 0 },
      { color: '#00ff00', position: 1 }
    ])
    expect(seedStops([])).toEqual([
      { color: '#000000', position: 0 },
      { color: '#ffffff', position: 1 }
    ])
  })
})
