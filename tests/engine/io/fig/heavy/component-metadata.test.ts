import { expect, setDefaultTimeout, test } from 'bun:test'

import { parseFigBuffer, materializeDocument } from '@open-pencil/fig'

import { expectDefined } from '#tests/helpers/assert'
import { readFixtureArrayBuffer } from '#tests/helpers/fig/fixtures'
import { heavy } from '#tests/helpers/test-utils'

function importFixture(name: string) {
  const { nodeChanges, blobs, images } = parseFigBuffer(readFixtureArrayBuffer(name))
  // Library default is strict; skip the stale override records Figma keeps, as the app does.
  return materializeDocument(nodeChanges, blobs, {
    images: new Map(images),
    derivedBounds: true,
    onUnresolvedProperty: () => undefined,
    onUnresolvedAssignment: () => undefined
  }).graph
}

setDefaultTimeout(30_000)

heavy('fig component metadata import', () => {
  test('preserves remote library component identity fields', () => {
    const graph = importFixture('gold-preview.fig')
    const component = expectDefined(
      graph
        .getAllNodes()
        .find((node) => node.componentKey === '26164e029c485511adfa634522024c7c23e7bb81'),
      'remote component'
    )

    expect(component.sourceLibraryKey).toStartWith('lk-')
    expect(component.publishId).toBe('4132:5801')
    expect(component.overrideKey).toBe('4132:5801')
    expect(component.sharedSymbolVersion).toBe('4152:1913')
    expect(component.isSymbolPublishable).toBe(false)
  }, 10_000)

  test('imports component set docs and variant property specs', () => {
    const graph = importFixture('material3.fig')
    const buttonSet = expectDefined(
      graph.getAllNodes().find((node) => node.type === 'COMPONENT_SET' && node.name === 'Button'),
      'Button component set'
    )

    expect(buttonSet.isPublishable).toBe(true)
    expect(buttonSet.symbolDescription).toContain('Buttons communicate actions')
    // The visible Buttons page copy (57994:2227); internal-only copies carry an http link.
    expect(buttonSet.symbolLinks.map((link) => link.uri)).toContain(
      'https://m3.material.io/components/buttons/overview'
    )
    expect(buttonSet.componentPropertyDefinitions.map((def) => def.name)).toContain('State')

    const variant = expectDefined(
      graph
        .getChildren(buttonSet.id)
        .find((node) => node.type === 'COMPONENT' && node.name.includes('State=Disabled')),
      'disabled Button variant'
    )
    expect(variant.variantPropSpecs.length).toBeGreaterThan(0)
    expect(variant.componentPropertyValues.State).toBe('Disabled')
    expect(Object.keys(variant.componentPropertyValues).sort()).toEqual(['Size', 'State', 'Type'])
    expect(Object.keys(variant.componentPropertyValues).some((key) => key.includes(':'))).toBe(
      false
    )
  })
})
