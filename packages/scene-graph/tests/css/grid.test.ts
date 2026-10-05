import { describe, expect, test } from 'bun:test'

import { parseCSSGridTracks } from '@open-pencil/scene-graph/css'

const FR = { sizing: 'FR', value: 1 }
const AUTO = { sizing: 'AUTO', value: 0 }
const fixed = (value: number) => ({ sizing: 'FIXED', value })

describe('parseCSSGridTracks', () => {
  test.each([
    ['1fr 200px 1fr', [FR, fixed(200), FR]],
    ['2fr 64', [{ sizing: 'FR', value: 2 }, fixed(64)]],
    ['repeat(3, 1fr)', [FR, FR, FR]],
    ['repeat(2, 40px 1fr)', [fixed(40), FR, fixed(40), FR]],
    ['minmax(0, 1fr) auto', [FR, AUTO]],
    ['repeat(2, minmax(0, 1fr) 100px)', [FR, fixed(100), FR, fixed(100)]],
    ['  REPEAT( 2 ,  1fr )   120px  ', [FR, FR, fixed(120)]],
    ['10rem 1fr', [fixed(160), FR]]
  ])('%p', (value, tracks) => {
    expect(parseCSSGridTracks(value)).toEqual(tracks)
  })

  test.each([
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
