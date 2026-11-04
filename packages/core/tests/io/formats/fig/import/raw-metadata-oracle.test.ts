import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import type { Color } from '@open-pencil/scene-graph/primitives'

interface RawMetadataOracle {
  page: {
    guides: Array<{ axis: string; offset: number }>
  }
  frame: {
    id: string
    layoutGrids: Array<{
      pattern: string
      alignment: string
      count: number
      sectionSize: number
      gutterSize: number
      offset: number
      color: Color
    }>
    exportSettings: Array<{
      format: string
      suffix: string
      contentsOnly: boolean
      colorProfile: string
      constraint: { type: string; value: number }
    }>
  }
  text: {
    id: string
    exportSettings: Array<{
      format: string
      suffix: string
      useAbsoluteBounds: boolean
      svgOutlineText: boolean
      svgIdAttribute: boolean
      svgSimplifyStroke: boolean
    }>
  }
  notes: string[]
}

function readOracle(): RawMetadataOracle {
  return JSON.parse(readFileSync('tests/fixtures/figma-oracles/raw-metadata.json', 'utf8'))
}

describe('Figma raw metadata oracle', () => {
  test('records live page guides from Figma Plugin API', () => {
    const oracle = readOracle()

    expect(oracle.page.guides).toEqual([
      { axis: 'X', offset: 42 },
      { axis: 'Y', offset: 84 }
    ])
  })

  test('records live layout grid payloads from Figma Plugin API', () => {
    const oracle = readOracle()
    const grid = oracle.frame.layoutGrids[0]

    expect(oracle.frame.id).toBe('297470:2274')
    expect(grid?.pattern).toBe('COLUMNS')
    expect(grid?.alignment).toBe('MIN')
    expect(grid?.count).toBe(4)
    expect(grid?.sectionSize).toBe(48)
    expect(grid?.gutterSize).toBe(16)
    expect(grid?.offset).toBe(16)
    expect(grid?.color.a).toBeCloseTo(0.1)
  })

  test('records live export settings constraints and node-specific field support', () => {
    const oracle = readOracle()
    const frameExport = oracle.frame.exportSettings[0]
    const textExport = oracle.text.exportSettings[0]

    expect(frameExport).toMatchObject({
      format: 'PNG',
      suffix: '@2x',
      contentsOnly: true,
      colorProfile: 'DOCUMENT',
      constraint: { type: 'SCALE', value: 2 }
    })
    expect(textExport).toMatchObject({
      format: 'SVG',
      suffix: '-svg',
      useAbsoluteBounds: true,
      svgOutlineText: true,
      svgIdAttribute: false,
      svgSimplifyStroke: true
    })
    expect(oracle.notes.join(' ')).toContain('Frame export settings reject useAbsoluteBounds')
  })
})
