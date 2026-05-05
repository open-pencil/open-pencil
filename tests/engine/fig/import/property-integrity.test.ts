import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import {
  parseFigFile,
  computeAllLayouts,
  exportFigFile,
  importNodeChanges,
  initCodec,
  FigmaAPI,
  type SceneGraph,
  type SceneNode,
  type Fill
} from '@open-pencil/core'

import { computeContentBounds } from '#core/io/formats/raster/render'

import { expectDefined } from '#tests/helpers/assert'
import {
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

describe('property integrity', () => {
  test('all nodes have finite dimensions', () => {
    for (const n of allNodes) {
      expect(Number.isFinite(n.width)).toBe(true)
      expect(Number.isFinite(n.height)).toBe(true)
      expect(n.width).toBeGreaterThanOrEqual(0)
      expect(n.height).toBeGreaterThanOrEqual(0)
    }
  })

  test('all nodes have finite positions', () => {
    for (const n of allNodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
  })

  test('all nodes have valid opacity', () => {
    for (const n of allNodes) {
      expect(n.opacity).toBeGreaterThanOrEqual(0)
      expect(n.opacity).toBeLessThanOrEqual(1)
    }
  })

  test('TEXT nodes have fontFamily', () => {
    for (const n of allNodes) {
      if (n.type === 'TEXT') {
        expect(typeof n.fontFamily).toBe('string')
        expect(n.fontFamily.length).toBeGreaterThan(0)
      }
    }
  })

  test('TEXT nodes have valid fontSize', () => {
    for (const n of allNodes) {
      if (n.type === 'TEXT') {
        expect(n.fontSize).toBeGreaterThan(0)
      }
    }
  })

  test('fills have valid colors', () => {
    function checkFill(fill: Fill, nodeName: string) {
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
    for (const n of allNodes) {
      for (const fill of n.fills) {
        checkFill(fill, n.name)
      }
    }
  })

  test('effects have valid radius', () => {
    for (const n of allNodes) {
      for (const e of n.effects) {
        expect(e.radius).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('layout nodes have valid spacing', () => {
    for (const n of allNodes) {
      if (n.layoutMode !== 'NONE') {
        expect(Number.isFinite(n.itemSpacing)).toBe(true)
        expect(n.paddingTop).toBeGreaterThanOrEqual(0)
        expect(n.paddingRight).toBeGreaterThanOrEqual(0)
        expect(n.paddingBottom).toBeGreaterThanOrEqual(0)
        expect(n.paddingLeft).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
