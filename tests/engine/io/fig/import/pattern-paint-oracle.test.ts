import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import * as v from 'valibot'

const OracleVector = v.object({ x: v.number(), y: v.number() })

const PatternOracleFill = v.object({
  type: v.string(),
  sourceNodeId: v.string(),
  tileType: v.string(),
  spacing: OracleVector,
  horizontalAlignment: v.string(),
  verticalAlignment: v.string()
})

const EffectOracleResult = v.object({
  ok: v.boolean(),
  effects: v.array(
    v.object({
      type: v.string(),
      noiseType: v.optional(v.string()),
      noiseSize: v.optional(v.number()),
      noiseSizeVector: v.optional(OracleVector),
      density: v.optional(v.number()),
      opacity: v.optional(v.number()),
      secondaryColor: v.optional(v.unknown())
    })
  )
})

const OracleSource = v.object({ id: v.string(), visible: v.boolean() })

const PaintOracleJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    pattern: v.object({
      frame: v.object({ id: v.string() }),
      source: OracleSource,
      target: v.object({ fills: v.array(PatternOracleFill) })
    }),
    patternAlignment: v.object({
      frame: v.object({ id: v.string() }),
      source: OracleSource,
      targets: v.array(v.object({ alignment: v.string(), fills: v.array(PatternOracleFill) })),
      metrics: v.object({ rmseNormalized: v.number(), fuzzDifferentPixels: v.number() }),
      analysis: v.record(
        v.string(),
        v.object({
          pairedRowCount: v.number(),
          avgDeltaY: v.number(),
          avgDeltaFirstX: v.number(),
          missingOpenPencilRows: v.number(),
          extraOpenPencilRows: v.number()
        })
      )
    }),
    effects: v.object({
      noise: v.object({ results: v.record(v.string(), EffectOracleResult) }),
      textureAndGlass: v.object({ results: v.record(v.string(), EffectOracleResult) })
    }),
    pluginRuntimeCreation: v.record(v.string(), v.object({ ok: v.boolean(), message: v.string() })),
    currentFileFillTypes: v.record(v.string(), v.number()),
    localFigFixtureFillTypes: v.record(v.string(), v.record(v.string(), v.number())),
    status: v.string()
  })
)

function readOracle() {
  return v.parse(
    PaintOracleJSON,
    readFileSync('tests/fixtures/figma-oracles/pattern-noise-custom-paints.json', 'utf8')
  )
}

describe('Figma pattern/noise/custom paint oracle availability', () => {
  test('records the live Figma pattern paint payload', () => {
    const oracle = readOracle()
    const patternFill = oracle.pattern.target.fills[0]

    expect(oracle.pattern.source.visible).toBe(true)
    expect(patternFill?.type).toBe('PATTERN')
    expect(patternFill?.sourceNodeId).toBe(oracle.pattern.source.id)
    expect(patternFill?.tileType).toBe('RECTANGULAR')
    expect(patternFill?.spacing.x).toBe(0.25)
    expect(patternFill?.spacing.y).toBeCloseTo(0.4)
    expect(patternFill?.horizontalAlignment).toBe('CENTER')
    expect(patternFill?.verticalAlignment).toBe('CENTER')
  })

  test('records Figma pattern alignment payloads and current visual metrics', () => {
    const alignment = readOracle().patternAlignment

    expect(alignment.source.visible).toBe(true)
    expect(alignment.targets.map((target) => target.alignment)).toEqual(['START', 'CENTER', 'END'])
    for (const target of alignment.targets) {
      const fill = target.fills[0]
      expect(fill?.type).toBe('PATTERN')
      expect(fill?.sourceNodeId).toBe(alignment.source.id)
      expect(fill?.horizontalAlignment).toBe(target.alignment)
      expect(fill?.verticalAlignment).toBe(target.alignment)
      expect(fill?.spacing.y).toBeCloseTo(0.4)
    }
    expect(alignment.metrics.rmseNormalized).toBeCloseTo(0.246422)
    expect(alignment.metrics.fuzzDifferentPixels).toBe(22209)
    expect(alignment.analysis.START).toMatchObject({ avgDeltaY: 0, avgDeltaFirstX: 0 })
    expect(alignment.analysis.CENTER).toMatchObject({ avgDeltaY: 3, avgDeltaFirstX: -0.5 })
    expect(alignment.analysis.END).toMatchObject({ avgDeltaY: -6.67, avgDeltaFirstX: -0.5 })
  })

  test('records that noise and custom paint payloads are still blocked on Figma-authored samples', () => {
    const oracle = readOracle()
    expect(oracle.pluginRuntimeCreation.PATTERN_DIRECT_FILLS_ASSIGNMENT?.ok).toBe(false)

    for (const type of ['NOISE', 'CUSTOM']) {
      expect(oracle.pluginRuntimeCreation[`${type}_ASYNC_FILLS`]?.ok).toBe(false)
      expect(oracle.currentFileFillTypes[type]).toBeUndefined()
      for (const counts of Object.values(oracle.localFigFixtureFillTypes)) {
        expect(counts[type]).toBeUndefined()
      }
    }
    expect(oracle.status).toContain('NOISE and CUSTOM paint payloads')
  })

  test('records Figma-authored noise effect payloads for follow-up effect fidelity work', () => {
    const { results } = readOracle().effects.noise

    expect(results.MONOTONE?.ok).toBe(true)
    expect(results.DUOTONE?.ok).toBe(true)
    expect(results.MULTITONE?.ok).toBe(true)

    const monotone = results.MONOTONE?.effects[0]
    const duotone = results.DUOTONE?.effects[0]
    const multitone = results.MULTITONE?.effects[0]

    expect(monotone?.type).toBe('NOISE')
    expect(monotone?.noiseType).toBe('MONOTONE')
    expect(monotone?.noiseSizeVector).toEqual({ x: 0.5, y: 0.5 })
    expect(monotone?.density).toBeCloseTo(0.4)
    expect(duotone?.secondaryColor).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    expect(multitone?.opacity).toBeCloseTo(0.7)
  })

  test('records texture and glass effect payloads separately from unavailable custom paints', () => {
    const { results } = readOracle().effects.textureAndGlass

    expect(results.TEXTURE?.ok).toBe(true)
    expect(results.TEXTURE?.effects[0]?.type).toBe('TEXTURE')
    expect(results.TEXTURE?.effects[0]?.noiseSizeVector).toEqual({ x: 0.5, y: 0.5 })
    expect(results.GLASS?.ok).toBe(true)
    expect(results.GLASS?.effects[0]?.type).toBe('GLASS')
  })
})
