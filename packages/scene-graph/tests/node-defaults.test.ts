import { describe, expect, test } from 'bun:test'

import type { SceneNode } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

describe('createDefaultNode', () => {
  test('new layers own their collections and metadata', () => {
    const first = createDefaultNode(() => 'first', 'RECTANGLE')
    const second = createDefaultNode(() => 'second', 'RECTANGLE')
    for (const key of Object.keys(first) as Array<keyof SceneNode>) {
      const value = first[key]
      // Letter spacing is the existing shared constant; other non-null objects are mutable.
      if (key !== 'letterSpacing' && value !== null && typeof value === 'object') {
        expect(second[key], key).not.toBe(value)
      }
    }

    first.childIds.push('child')
    first.source.editedFields.push('width')
    first.source.fig.rawNodeFields['test'] = true
    first.instanceOverrides.self.set('width', 200)
    first.instanceOverrides.descendants.set('child', new Map([['height', 300]]))
    first.boundVariables['width'] = 'variable'
    first.pluginRelaunchData.push({
      pluginId: 'plugin',
      command: 'command',
      message: 'message',
      isDeleted: false
    })

    const later = createDefaultNode(() => 'later', 'RECTANGLE')
    for (const node of [second, later]) {
      expect(node.childIds).toEqual([])
      expect(node.source.editedFields).toEqual([])
      expect(node.source.fig.rawNodeFields).toEqual({})
      expect(node.instanceOverrides.self.size).toBe(0)
      expect(node.instanceOverrides.descendants.size).toBe(0)
      expect(node.boundVariables).toEqual({})
      expect(node.pluginRelaunchData).toEqual([])
    }
  })

  test('text paints are independent and type defaults survive alternating kinds', () => {
    const first = createDefaultNode(() => 'first', 'TEXT')
    const line = createDefaultNode(() => 'line', 'LINE')
    const second = createDefaultNode(() => 'second', 'TEXT')
    const rectangle = createDefaultNode(() => 'rect', 'RECTANGLE')
    first.fills[0].opacity = 0.5

    expect(first.fills).not.toBe(second.fills)
    expect(second.fills[0].opacity).toBe(1)
    expect(second.strokeAlign).toBe('OUTSIDE')
    expect(second.name).toBe('Text')
    expect(line.strokeAlign).toBe('CENTER')
    expect(rectangle.strokeAlign).toBe('INSIDE')
    expect(rectangle.fills).toEqual([])
  })

  test('caller overrides replace defaults, including generated identity and collections', () => {
    let generated = 0
    const childIds = ['child']
    const node = createDefaultNode(() => String(++generated), 'TEXT', {
      id: 'imported',
      name: 'Imported label',
      childIds,
      fills: [],
      strokeAlign: 'CENTER',
      booleanOperation: 'SUBTRACT'
    })

    expect(generated).toBe(1)
    expect(node.id).toBe('imported')
    expect(node.name).toBe('Imported label')
    expect(node.childIds).toBe(childIds)
    expect(node.fills).toEqual([])
    expect(node.strokeAlign).toBe('CENTER')
    expect(node.booleanOperation).toBe('SUBTRACT')
  })

  test('imported fields keep their values and ownership without mutating the input', () => {
    const imported = createDefaultNode(() => 'imported', 'TEXT')
    imported.source.editedFields.push('width')
    imported.instanceOverrides.self.set('width', 240)
    imported.variableBindingScales['width'] = 2
    const before = structuredClone(imported)
    Object.freeze(imported)

    const node = createDefaultNode(() => 'generated', 'RECTANGLE', imported)
    expect(node).not.toBe(imported)
    for (const key of Object.keys(imported) as Array<keyof SceneNode>) {
      expect(node[key], key).toBe(imported[key])
    }
    expect(imported).toEqual(before)
  })
})
