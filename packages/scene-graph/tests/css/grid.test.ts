import { describe, expect, test } from 'bun:test'

import type { GridTrack } from '@open-pencil/scene-graph'
import { parseCSSGridTracks } from '@open-pencil/scene-graph/css'

const fr = (value: number): GridTrack => ({ sizing: 'FR', value })
const fixed = (value: number): GridTrack => ({ sizing: 'FIXED', value })
const FR = fr(1)
const AUTO: GridTrack = { sizing: 'AUTO', value: 0 }

describe('parseCSSGridTracks', () => {
  test.each<[string, GridTrack[]]>([
    ['1fr 200px 1fr', [FR, fixed(200), FR]],
    ['2fr 64', [fr(2), fixed(64)]],
    ['repeat(3, 1fr)', [FR, FR, FR]],
    ['repeat(2, 40px 1fr)', [fixed(40), FR, fixed(40), FR]],
    ['minmax(0, 1fr) auto', [FR, AUTO]],
    ['repeat(2, minmax(0, 1fr) 100px)', [FR, fixed(100), FR, fixed(100)]],
    ['  REPEAT( 2 ,  1fr )   120px  ', [FR, FR, fixed(120)]],
    ['10rem 1fr', [fixed(160), FR]]
  ])('%p', (value, tracks) => {
    expect(parseCSSGridTracks(value)).toEqual(tracks)
  })

  test.each<[string, string, GridTrack[]]>([
    ['a length relative to the font', '10em 1fr', [AUTO, FR]],
    ['a sizing function', 'fit-content(200px) 1fr', [AUTO, FR]],
    ['a repeat that depends on the container', 'repeat(auto-fill, 100px)', [AUTO]]
  ])('sizes %s to its content, not to zero', (_case, value, tracks) => {
    expect(parseCSSGridTracks(value)).toEqual(tracks)
  })

  test('bounds a huge repeat count', () => {
    expect(parseCSSGridTracks('repeat(100000, 1fr)')).toHaveLength(100)
  })

  test('returns separate track objects for repeated tracks', () => {
    const [first, second] = parseCSSGridTracks('repeat(2, 1fr)')
    expect(first).not.toBe(second)
  })
})
