import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { computeContentBounds } from '#core/io/formats/raster/render'

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

import { expectDefined } from '../../../helpers/assert'
import {
  parseFixture,
  parseGoldPreviewFixture,
  VALID_NODE_TYPES
} from '../../../helpers/fig-fixtures'
import {
  childMatching,
  childNamed,
  collectAllNodes,
  countByType,
  previewChild
} from '../../../helpers/fig-traversal'
import { heavy } from '../../../helpers/test-utils'

setDefaultTimeout(60_000)

heavy('parse heavy .fig files', () => {
  let material3: SceneGraph
  let nuxtui: SceneGraph
  let material3Nodes: SceneNode[]
  let nuxtUiNodes: SceneNode[]

  beforeAll(async () => {
    material3 = await parseFixture('material3.fig')
    nuxtui = await parseFixture('nuxtui.fig')
    material3Nodes = collectAllNodes(material3)
    nuxtUiNodes = collectAllNodes(nuxtui)
  })

  test('material3.fig parses with pages and nodes', () => {
    expect(material3).toBeInstanceOf(SceneGraph)
    expect(material3.getPages().length).toBeGreaterThan(0)
    expect(material3Nodes.length).toBeGreaterThan(0)
  })

  test('nuxtui.fig parses with pages and nodes', () => {
    expect(nuxtui).toBeInstanceOf(SceneGraph)
    expect(nuxtui.getPages().length).toBeGreaterThan(0)
    expect(nuxtUiNodes.length).toBeGreaterThan(0)
  })

  test('material3: contains COMPONENT nodes', () => {
    expect(material3Nodes.some((n) => n.type === 'COMPONENT')).toBe(true)
  })

  test('material3: no unmapped node types', () => {
    const invalid = material3Nodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })

  test('nuxtui: no unmapped node types', () => {
    const invalid = nuxtUiNodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })

  test('material3: fills have valid colors', () => {
    for (const n of material3Nodes) {
      for (const fill of n.fills) {
        if (fill.type === 'SOLID') {
          const { r, g, b, a } = fill.color
          expect(r).toBeGreaterThanOrEqual(0)
          expect(r).toBeLessThanOrEqual(1)
          expect(g).toBeGreaterThanOrEqual(0)
          expect(g).toBeLessThanOrEqual(1)
          expect(b).toBeGreaterThanOrEqual(0)
          expect(b).toBeLessThanOrEqual(1)
          expect(a).toBeGreaterThanOrEqual(0)
          expect(a).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  test('nuxtui: fills have valid colors', () => {
    for (const n of nuxtUiNodes) {
      for (const fill of n.fills) {
        if (fill.type === 'SOLID') {
          expect(fill.color.r).toBeGreaterThanOrEqual(0)
          expect(fill.color.r).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})
