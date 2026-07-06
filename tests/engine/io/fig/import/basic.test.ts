import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/core'

import { parseGoldPreviewFixture, VALID_NODE_TYPES } from '#tests/helpers/fig-fixtures'
import { isLfsPointer } from '#tests/helpers/lfs'

setDefaultTimeout(60_000)

const fixtureIsLfs = isLfsPointer('tests/fixtures/gold-preview.fig')

let parsed: SceneGraph
let allNodes: SceneNode[]

beforeAll(async () => {
  if (fixtureIsLfs) return
  const fixture = await parseGoldPreviewFixture()
  parsed = fixture.graph
  allNodes = fixture.allNodes
})

describe.skipIf(fixtureIsLfs)('parse real .fig files', () => {
  test('parses without error', () => {
    expect(parsed).toBeInstanceOf(SceneGraph)
  })

  test('has pages', () => {
    expect(parsed.getPages().length).toBeGreaterThan(0)
  })

  test('has nodes', () => {
    expect(allNodes.length).toBeGreaterThan(0)
  })
})

describe.skipIf(fixtureIsLfs)('node type coverage', () => {
  test('contains FRAME nodes', () => {
    expect(allNodes.some((n) => n.type === 'FRAME')).toBe(true)
  })

  test('contains TEXT nodes with content', () => {
    const textNodes = allNodes.filter((n) => n.type === 'TEXT')
    expect(textNodes.length).toBeGreaterThan(0)
    expect(textNodes.some((n) => n.text.length > 0)).toBe(true)
  })

  test('contains INSTANCE nodes referencing components', () => {
    const instances = allNodes.filter((n) => n.type === 'INSTANCE')
    expect(instances.length).toBeGreaterThan(0)
    expect(instances.some((n) => n.componentId)).toBe(true)
  })

  test('no unmapped node types', () => {
    const invalid = allNodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })
})
