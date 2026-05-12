import { expect, setDefaultTimeout, test } from 'bun:test'
import { readFileSync } from 'fs'

import { importNodeChanges } from '#core/kiwi'
import { parseFigBuffer } from '#core/kiwi/fig/parse/core'

import { expectDefined } from '#tests/helpers/assert'
import { heavy } from '#tests/helpers/test-utils'

function importFixture(name: string) {
  const buffer = readFileSync(`tests/fixtures/${name}`).buffer
  const { nodeChanges, blobs, images } = parseFigBuffer(buffer)
  return importNodeChanges(nodeChanges, blobs, new Map(images))
}

setDefaultTimeout(20_000)

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
    expect(buttonSet.symbolLinks.map((link) => link.uri)).toContain(
      'http://m3.material.io/components/buttons/overview'
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
    expect(variant.componentPropertyValues.Style).toBe('Tonal')
    expect(Object.keys(variant.componentPropertyValues).some((key) => key.includes(':'))).toBe(
      false
    )
  }, 10_000)
})
