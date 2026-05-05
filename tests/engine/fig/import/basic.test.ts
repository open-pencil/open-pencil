import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import {
  parseFigFile,
  computeAllLayouts,
  exportFigFile,
  importNodeChanges,
  initCodec,
  SceneGraph,
  FigmaAPI,
  type SceneNode,
  type Fill
} from '@open-pencil/core'

import { computeContentBounds } from '#core/io/formats/raster/render'

import { expectDefined } from '#tests/helpers/assert'
import {
  FIXTURES,
  parseFixture,
  parseGoldPreviewFixture,
  VALID_NODE_TYPES
} from '#tests/helpers/fig-fixtures'
import {
  childMatching,
  childNamed,
  collectAllNodes,
  countByType,
  previewChild
} from '#tests/helpers/fig-traversal'
import { heavy } from '#tests/helpers/test-utils'

setDefaultTimeout(60_000)

let parsed: SceneGraph
let allNodes: SceneNode[]

beforeAll(async () => {
  const fixture = await parseGoldPreviewFixture()
  parsed = fixture.graph
  allNodes = fixture.allNodes
})

describe('parse real .fig files', () => {
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

describe('node type coverage', () => {
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
