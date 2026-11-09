import { expect, test } from 'bun:test'

import { digestOf } from '@/app/live-pages/drift/compare'
import { comparePages, setBaseline } from '@/app/live-pages/drift/run'
import { emptyDriftFile } from '@/app/live-pages/drift/schema'

const target = { nodeId: 'frame-1', url: 'http://localhost:3000/pricing' }

function captureOf(text: string) {
  return async () => ({ bytes: new TextEncoder().encode(text), width: 1440, height: 900 })
}

test('a baseline keeps the picture it was set from', async () => {
  const file = await setBaseline(emptyDriftFile(), target, captureOf('first'))
  const reference = file.references['frame-1']
  expect(reference?.digest).toBe(await digestOf(new TextEncoder().encode('first')))
  expect(reference?.width).toBe(1440)
  expect(reference?.url).toBe(target.url)
})

test('a page that cannot be captured leaves the baseline alone', async () => {
  const before = await setBaseline(emptyDriftFile(), target, captureOf('first'))
  const after = await setBaseline(before, target, async () => null)
  expect(after).toEqual(before)
})

test('comparing answers same, changed, and nothing-to-compare', async () => {
  const file = await setBaseline(emptyDriftFile(), target, captureOf('first'))
  expect(await comparePages(file, [target], captureOf('first'))).toEqual([
    { nodeId: 'frame-1', state: 'same' }
  ])
  expect(await comparePages(file, [target], captureOf('second'))).toEqual([
    { nodeId: 'frame-1', state: 'changed' }
  ])
  expect(await comparePages(emptyDriftFile(), [target], captureOf('first'))).toEqual([
    { nodeId: 'frame-1', state: 'none' }
  ])
})

test('a page that could not be captured has nothing to compare', async () => {
  const file = await setBaseline(emptyDriftFile(), target, captureOf('first'))
  expect(await comparePages(file, [target], async () => null)).toEqual([
    { nodeId: 'frame-1', state: 'none' }
  ])
})

test('a capture that throws costs one page, not the comparison', async () => {
  const file = await setBaseline(emptyDriftFile(), target, captureOf('first'))
  const second = { nodeId: 'frame-2', url: 'http://localhost:3000/pricing' }
  const compared = await comparePages(file, [target, second], async (requested) => {
    if (requested.nodeId === second.nodeId) throw new Error('no browser')
    return { bytes: new TextEncoder().encode('first'), width: 1440, height: 900 }
  })

  expect(compared).toEqual([
    { nodeId: 'frame-1', state: 'same' },
    { nodeId: 'frame-2', state: 'none' }
  ])
})

test('a capture that throws leaves the baseline it could not replace', async () => {
  const before = await setBaseline(emptyDriftFile(), target, captureOf('first'))
  const after = await setBaseline(before, target, async () => {
    throw new Error('no browser')
  })

  expect(after).toEqual(before)
})
