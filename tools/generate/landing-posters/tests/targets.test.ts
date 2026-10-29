import { describe, expect, test } from 'bun:test'

import { parseShard, posterFiles, posterTargets, shardTargets } from '#landing-posters/targets'

const FINGERPRINT = '0123456789abcdef'

describe('landing poster targets', () => {
  test('cover each locale in both themes and layouts', () => {
    const targets = posterTargets(FINGERPRINT)
    expect(targets).toContainEqual({
      fingerprint: FINGERPRINT,
      locale: 'root',
      theme: 'dark',
      layout: 'phone'
    })
    expect(targets.length % 4).toBe(0)
  })

  test('split into shards that together capture every page once', () => {
    const targets = posterTargets(FINGERPRINT)
    const shards = [1, 2, 3, 4].map((index) => shardTargets(targets, { index, count: 4 }))
    expect(shards.flat()).toHaveLength(targets.length)
    expect(new Set(shards.flat()).size).toBe(targets.length)
    for (const shard of shards) expect(shard.length).toBe(targets.length / 4)
  })

  test('read a shard as index/count and refuse anything else', () => {
    expect(parseShard('2/4')).toEqual({ index: 2, count: 4 })
    expect(() => parseShard('0/4')).toThrow()
    expect(() => parseShard('5/4')).toThrow()
    expect(() => parseShard('2')).toThrow()
  })

  test('list one still per stage part of a page', () => {
    const [target] = posterTargets(FINGERPRINT)
    if (!target) throw new Error('no targets')
    const files = posterFiles(target)
    expect(new Set(files).size).toBe(files.length)
    expect(files).toContain(`landing-posters/${FINGERPRINT}/root/light-desktop/collab-frame.webp`)
  })
})
