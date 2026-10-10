import { describe, expect, test } from 'bun:test'

import {
  addShaderEffect,
  loadShaderCatalog,
  moveShaderEffect,
  parseShaderPreset,
  removeShaderEffect,
  setShaderEffectProp,
  shaderPresetJSON
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
