import { expect, test } from 'bun:test'

import { parseFigBuffer } from '@open-pencil/fig'

import { interpretInstance, type InstanceOccurrence } from '../src/instance-overrides/interpret'

function named(node: InstanceOccurrence, name: string): InstanceOccurrence {
  const child = node.children.find((candidate) => candidate.properties.name === name)
  if (!child) throw new Error(`Missing ${name} under ${node.properties.name}`)
  return child
}

// Expectations captured from gold-preview in Figma, input 1:3503.
// Exercise the original archive: no pre-resolved SceneGraph or legacy replay.
test('Gold Preview input resolves badge visibility and distinct avatar swaps like Figma', async () => {
  const bytes = await Bun.file(
    new URL('../../../tests/fixtures/gold-preview.fig', import.meta.url)
  ).arrayBuffer()
  const { nodeChanges } = parseFigBuffer(bytes)
  const diagnostics: unknown[] = []
  const input = interpretInstance(nodeChanges, '1:3503', {
    onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
  })
  const frame = named(named(input, '_input'), 'Input')
  const tags = named(named(frame, 'Content'), 'Tags')
  const badges = tags.children.filter((node) => node.properties.name === 'Badge')
  expect(badges).toHaveLength(3)
  expect(badges.map((badge) => badge.mainComponentId)).toEqual(['1:935', '1:935', '1:935'])
  const content = badges.map((badge) => named(badge, '_badge-and-tag'))
  expect(content.map((node) => named(node, 'Avatar').mainComponentId)).toEqual([
    '1:726',
    '1:1759',
    '1:1761'
  ])
  for (const node of content) {
    expect(named(node, 'Avatar').properties.visible).toBe(true)
    expect(named(node, 'home').properties.visible).toBe(false)
    expect(named(node, 'chevron-right').properties.visible).toBe(false)
    expect(named(node, 'Close-Icon').properties.visible).toBe(true)
  }
  expect(named(named(frame, 'Leading'), 'Avatar').properties.visible).toBe(false)
  expect(named(named(frame, 'Trailing'), 'Avatar').properties.visible).toBe(false)
  expect(diagnostics.length).toBeGreaterThan(0)
})
