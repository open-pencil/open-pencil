import { describe, expect, test } from 'bun:test'

import {
  FontResolver,
  fontCoverageDemand,
  missingGlyphCharacters,
  missingGlyphScripts,
  type FontResolutionCandidate,
  type FontResolutionDemand,
  type ObservedShapedLine
} from '@open-pencil/core/text'

function candidate(source: FontResolutionCandidate['source']): FontResolutionCandidate {
  return { id: source, family: 'Example', style: 'Regular', source }
}

function faceDemand(): FontResolutionDemand {
  return {
    key: 'face:example:regular',
    candidates: ['registered', 'local', 'cache', 'remote'].map((source) =>
      candidate(source as FontResolutionCandidate['source'])
    )
  }
}

function shapedLine(textLength: number, glyphs: number[], offsets: number[]): ObservedShapedLine {
  return {
    textRange: { last: textLength },
    runs: [
      {
        glyphs: Uint16Array.from(glyphs),
        offsets: Uint32Array.from(offsets)
      }
    ]
  }
}

describe('FontResolver', () => {
  test('tries face candidates in source order', async () => {
    const attempted: string[] = []
    const resolver = new FontResolver(async (item) => {
      attempted.push(item.source)
      return item.source === 'remote'
    })

    const result = await resolver.demand(faceDemand())

    expect(attempted).toEqual(['registered', 'local', 'cache', 'remote'])
    expect(result.state).toBe('loaded')
    expect(result.source).toBe('remote')
  })

  test('deduplicates concurrent demand and collects settle callbacks', async () => {
    let release: ((loaded: boolean) => void) | undefined
    let loads = 0
    const resolver = new FontResolver(
      () =>
        new Promise<boolean>((resolve) => {
          loads++
          release = resolve
        })
    )
    const settled: string[] = []
    const demand = { key: 'shared', candidates: [candidate('local')] }

    const first = resolver.demand(demand, () => settled.push('first'))
    const second = resolver.demand(demand, () => settled.push('second'))

    expect(first).toBe(second)
    expect(loads).toBe(1)
    expect(resolver.state(demand).state).toBe('loading')
    release?.(true)
    await first
    expect(settled).toEqual(['first', 'second'])
  })

  test('settles only nodes that depend on the resolved key', async () => {
    let release: ((loaded: boolean) => void) | undefined
    const resolver = new FontResolver(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )
    const demand = { key: 'node-aware', candidates: [candidate('remote')] }
    const settled: string[][] = []

    const onSettled = (_snapshot: unknown, nodeIds: readonly string[]) => {
      settled.push([...nodeIds])
    }
    const first = resolver.demandForNode(demand, 'first', onSettled)
    const second = resolver.demandForNode(demand, 'second', onSettled)
    expect(resolver.pendingNodeIds(demand)).toEqual(['first', 'second'])

    release?.(true)
    await Promise.all([first, second])
    expect(settled).toEqual([['first', 'second']])
    expect(resolver.pendingNodeIds(demand)).toEqual([])
  })

  test('notifies subscribers when resolution starts, settles, and resets', async () => {
    const resolver = new FontResolver(async () => true)
    const demand = { key: 'observed', candidates: [candidate('local')] }
    const events: string[] = []
    const unsubscribe = resolver.subscribe((event, snapshot) => {
      events.push(`${event}:${snapshot.state}`)
    })

    await resolver.demand(demand)
    resolver.reset(demand)
    unsubscribe()
    await resolver.demand({ key: 'ignored', candidates: [candidate('local')] })

    expect(events).toEqual(['started:loading', 'settled:loaded', 'reset:idle'])
  })

  test('exhausts after every candidate is unavailable', async () => {
    const resolver = new FontResolver(async () => false)
    const demand = faceDemand()

    expect((await resolver.demand(demand)).state).toBe('exhausted')
    expect(resolver.state(demand).state).toBe('exhausted')
  })

  test('records loader failures and retries explicitly', async () => {
    let attempts = 0
    const resolver = new FontResolver(async () => {
      attempts++
      if (attempts === 1) throw new Error('provider offline')
      return true
    })
    const demand = { key: 'retry', candidates: [candidate('remote')] }

    expect((await resolver.demand(demand)).state).toBe('failed')
    expect((await resolver.retry(demand)).state).toBe('loaded')
    expect(attempts).toBe(2)
  })

  test('reset returns a settled key to idle', async () => {
    const resolver = new FontResolver(async () => true)
    const demand = { key: 'reset', candidates: [candidate('local')] }
    await resolver.demand(demand)

    resolver.reset(demand)

    expect(resolver.state(demand).state).toBe('idle')
  })
})

describe('observed glyph coverage', () => {
  test('maps CanvasKit UTF-8 offsets back to supplementary code points', () => {
    const text = 'A𠀀B'
    const lines = [shapedLine(6, [12, 0, 13], [0, 1, 5, 6])]

    expect(missingGlyphCharacters(text, lines)).toEqual(['𠀀'])
    expect(missingGlyphScripts(text, lines)).toEqual(['cjk-sc'])
  })

  test('supports UTF-16 offsets from mocked shapers', () => {
    const text = 'éAB'
    const lines = [shapedLine(text.length, [12, 13, 0], [0, 1, 2, 3])]

    expect(missingGlyphCharacters(text, lines)).toEqual(['B'])
  })

  test('does not report non-zero glyphs as missing', () => {
    const lines = [shapedLine(2, [12, 13], [0, 1, 2])]
    expect(missingGlyphCharacters('你好', lines)).toEqual([])
  })

  test('creates distinct coverage keys for distinct observed characters', () => {
    expect(fontCoverageDemand('cjk-sc', ['你']).key).not.toBe(
      fontCoverageDemand('cjk-sc', ['𠀀']).key
    )
  })
})
