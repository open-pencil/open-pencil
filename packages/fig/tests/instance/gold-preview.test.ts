import { expect, test } from 'bun:test'

import { materializeComponentClosure } from '#fig/instance-overrides/component-closure'
import { interpretInstance, type InstanceOccurrence } from '#fig/instance-overrides/interpret'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'
import {
  linkInstanceSourceChildren,
  mapInstanceSourceChildren
} from '#fig/instance-overrides/source-children'

import { FigmaAPI } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

function named(node: InstanceOccurrence, name: string): InstanceOccurrence {
  const child = node.children.find((candidate) => candidate.properties.name === name)
  if (!child) throw new Error(`Missing ${name} under ${node.properties.name}`)
  return child
}

// Expectations captured from gold-preview in Figma, input 1:3503.
// Exercise the original archive: no pre-resolved SceneGraph or legacy replay.
test('Gold Preview input resolves badge visibility and distinct avatar swaps like Figma', async () => {
  const bytes = await Bun.file(
    new URL('../../../../tests/fixtures/gold-preview.fig', import.meta.url)
  ).arrayBuffer()
  const { nodeChanges, blobs } = parseFigBuffer(bytes)
  const diagnostics: unknown[] = []
  const input = interpretInstance(nodeChanges, '1:3503', {
    derivedBounds: true,
    onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
  })
  const frame = named(named(input, '_input'), 'Input')
  expect(frame.properties.size?.x).toBeCloseTo(375.7498169, 5)
  expect(frame.properties.size?.y).toBeCloseTo(39.3802605, 5)
  const placeholder = named(named(named(frame, 'Content'), 'Placeholder'), 'Placeholder')
  expect(placeholder.properties.fontSize).toBeCloseTo(12.471817970275879, 6)
  expect(placeholder.properties.lineHeight).toEqual({ value: 17.816883087158203, units: 'PIXELS' })
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

  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const closure = materializeComponentClosure(graph, page.id, nodeChanges, input, blobs, {
    derivedBounds: true,
    onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
  })
  const components = new Map(
    [...closure].map(([id, component]) => [id, component.materialized.root.id])
  )
  const materialized = materializeInstance(
    graph,
    page.id,
    input,
    components,
    blobs,
    mapInstanceSourceChildren(input, closure)
  )
  linkInstanceSourceChildren(input, materialized, closure)
  const labels = content.map((node) => named(named(node, 'Placeholder'), 'Placeholder'))
  const first = materialized.nodes.get(labels[0])
  if (!first) throw new Error('Missing first badge label')
  const before = structuredClone(input)
  const api = new FigmaAPI(graph)
  api.wrapNode(first.id).characters = 'Edited badge'
  expect(first.text).toBe('Edited badge')
  expect(materialized.nodes.get(labels[1])?.text).toBe('Badge')
  expect(materialized.nodes.get(labels[2])?.text).toBe('Badge')
  expect(input).toEqual(before)

  const badgeComponent = closure.get('1:935')
  if (!badgeComponent) throw new Error('Missing real badge component')
  const sourceLabelOccurrence = named(
    named(named(badgeComponent.occurrence, '_badge-and-tag'), 'Placeholder'),
    'Placeholder'
  )
  const sourceLabel = badgeComponent.materialized.nodes.get(sourceLabelOccurrence)
  if (!sourceLabel) throw new Error('Missing badge component label')
  api.wrapNode(sourceLabel.id).characters = 'Updated component'
  const beforeIds = [...materialized.nodes.values()].map((node) => node.id)
  const beforeChildren = [...materialized.nodes.values()].map((node) => [...node.childIds])
  const avatarIds = content.map(
    (node) => materialized.nodes.get(named(node, 'Avatar'))?.componentId
  )
  graph.syncInstances(badgeComponent.materialized.root.id)
  expect(first.text).toBe('Edited badge')
  // Figma reports characters overrides on source badges 1:1820/1:1821/1:1822.
  // These are inherited explicit overrides, not unoverridden component defaults.
  expect(materialized.nodes.get(labels[1])?.text).toBe('Badge')
  expect(materialized.nodes.get(labels[2])?.text).toBe('Badge')
  expect(beforeIds.every((id) => graph.getNode(id))).toBe(true)
  expect([...materialized.nodes.values()].map((node) => node.childIds)).toEqual(beforeChildren)
  expect(content.map((node) => materialized.nodes.get(named(node, 'Avatar'))?.componentId)).toEqual(
    avatarIds
  )
  await initCodec()
  graph.updateNode(materialized.root.id, { name: 'Gold input acceptance' })
  const exported = await exportFigFile(graph)
  const restored = await parseFigFile(exported.buffer as ArrayBuffer)
  const restoredInput = [...restored.getAllNodes()].find(
    (node) => node.type === 'INSTANCE' && node.name === 'Gold input acceptance'
  )
  if (!restoredInput) throw new Error('Missing restored input')
  const restoredText: string[] = []
  const collectText = (id: string): void => {
    const node = restored.getNode(id)
    if (node?.type === 'TEXT') restoredText.push(node.text)
    for (const child of restored.getChildren(id)) collectText(child.id)
  }
  collectText(restoredInput.id)
  expect(restoredText.filter((text) => text === 'Edited badge')).toHaveLength(1)
  expect(restoredText.filter((text) => text === 'Badge')).toHaveLength(2)
  expect(restoredText).not.toContain('Updated component')
  const restoredByName = (id: string, name: string): string => {
    const child = restored.getChildren(id).find((node) => node.name === name)
    if (!child) throw new Error(`Missing restored ${name}`)
    return child.id
  }
  const restoredFrame = restoredByName(restoredByName(restoredInput.id, '_input'), 'Input')
  const restoredTags = restoredByName(restoredByName(restoredFrame, 'Content'), 'Tags')
  const restoredBadges = restored.getChildren(restoredTags).filter((node) => node.name === 'Badge')
  expect(restoredBadges).toHaveLength(3)
  for (const badge of restoredBadges) {
    const contentId = restoredByName(badge.id, '_badge-and-tag')
    expect(restored.getNode(restoredByName(contentId, 'home'))?.visible).toBe(false)
    expect(restored.getNode(restoredByName(contentId, 'chevron-right'))?.visible).toBe(false)
  }

  for (const node of content) {
    expect(materialized.nodes.get(named(node, 'home'))?.visible).toBe(false)
    expect(materialized.nodes.get(named(node, 'chevron-right'))?.visible).toBe(false)
  }
})
