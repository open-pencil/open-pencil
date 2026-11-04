import { describe, expect, test } from 'bun:test'

import { parseManifest, staticFiles } from '../src/budget'

describe('staticFiles', () => {
  const manifest = parseManifest(
    JSON.stringify({
      entry: { file: 'entry.js', imports: ['_shared', '_cycle'] },
      _shared: { file: 'shared.js' },
      _cycle: { file: 'cycle.js', imports: ['entry', '_shared'] },
      lazy: { file: 'lazy.js' }
    })
  )

  test('follows imports once and stops at what they do not reach', () => {
    expect(staticFiles(manifest, 'entry').toSorted()).toEqual(['cycle.js', 'entry.js', 'shared.js'])
  })

  test('rejects an entry the build no longer has', () => {
    expect(() => staticFiles(manifest, 'gone')).toThrow('no gone')
  })
})

test('parseManifest rejects a manifest of the wrong shape', () => {
  expect(() => parseManifest('{"entry":{}}')).toThrow('Invalid Vite manifest')
})
