import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import type { Vector } from '@open-pencil/scene-graph/primitives'

interface PatternOracleFill {
  type: string
  sourceNodeId: string
  tileType: string
  spacing: Vector
  horizontalAlignment: string
  verticalAlignment: string
}

interface EffectOracleResult {
  ok: boolean
  effects: Array<{
    type: string
    noiseType?: string
    noiseSize?: number
    noiseSizeVector?: Vector
    density?: number
    opacity?: number
    secondaryColor?: unknown
  }>
}

interface PaintOracle {
  pattern: {
    frame: { id: string }
    source: { id: string; visible: boolean }
    target: { fills: PatternOracleFill[] }
  }
  patternAlignment: {
    frame: { id: string }
    source: { id: string; visible: boolean }
    targets: Array<{ alignment: string; fills: PatternOracleFill[] }>
    metrics: { rmseNormalized: number; fuzzDifferentPixels: number }
    analysis: Record<
      string,
      {
        pairedRowCount: number
        avgDeltaY: number
        avgDeltaFirstX: number
        missingOpenPencilRows: number
        extraOpenPencilRows: number
      }
    >
  }
  effects: {
    noise: { results: Record<string, EffectOracleResult> }
    textureAndGlass: { results: Record<string, EffectOracleResult> }
  }
  pluginRuntimeCreation: Record<string, { ok: boolean; message: string }>
  currentFileFillTypes: Record<string, number>
  localFigFixtureFillTypes: Record<string, Record<string, number>>
  status: string
}

function readOracle(): PaintOracle {
  return JSON.parse(
    readFileSync('tests/fixtures/figma-oracles/pattern-noise-custom-paints.json', 'utf8')
  ) as PaintOracle
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
