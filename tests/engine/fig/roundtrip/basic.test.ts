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
  FIXTURES,
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

describe('roundtrip: export → re-import', () => {
  let reImported: SceneGraph
  let reImportedNodes: SceneNode[]

  beforeAll(async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page1 = graph.getPages()[0]
    const page2 = graph.addPage('Second Page')
    const internalPage = graph.addPage('Internal Only Canvas')
    internalPage.internalOnly = true
    graph.createNode('RECTANGLE', internalPage.id, {
      name: 'Internal Rect',
      width: 50,
      height: 50
    })

    graph.createNode('FRAME', page1.id, {
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24,
      cornerRadius: 12,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })

    const container = graph.getChildren(page1.id)[0]

    graph.createNode('RECTANGLE', container.id, {
      name: 'Header BG',
      x: 0,
      y: 0,
      width: 400,
      height: 80,
      cornerRadius: 8,
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      independentCorners: true,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        },
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 0.5,
          visible: true,
          blendMode: 'NORMAL',
          gradientStops: [
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 0, a: 0 }, position: 1 }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })

    graph.createNode('TEXT', container.id, {
      name: 'Title',
      x: 24,
      y: 100,
      width: 352,
      height: 24,
      text: 'Hello World',
      fontSize: 18,
      fontFamily: 'Inter',
      fontWeight: 700,
      textAlignHorizontal: 'CENTER'
    })

    graph.createNode('ELLIPSE', container.id, {
      name: 'Circle',
      x: 176,
      y: 140,
      width: 48,
      height: 48,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.9, g: 0.1, b: 0.3, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })

    graph.createNode('RECTANGLE', page2.id, {
      name: 'Page2 Rect',
      x: 50,
      y: 50,
      width: 100,
      height: 100
    })

    const figBytes = await exportFigFile(graph)
    reImported = await parseFigFile(figBytes.buffer as ArrayBuffer)
    reImportedNodes = collectAllNodes(reImported)
  })

  test('preserves page count', () => {
    expect(reImported.getPages().length).toBe(2)
  })

  test('preserves page names', () => {
    const names = reImported.getPages().map((p) => p.name)
    expect(names).toContain('Page 1')
    expect(names).toContain('Second Page')
  })

  test('preserves internal pages', () => {
    const allPages = reImported.getPages(true)
    const publicPages = reImported.getPages(false)
    expect(allPages.length).toBe(3)
    expect(publicPages.length).toBe(2)
    const internal = allPages.find((p) => p.internalOnly)
    expect(internal).toBeDefined()
    expect(internal?.name).toBe('Internal Only Canvas')
    expect(reImported.getChildren(internal?.id ?? '').length).toBe(1)
  })

  test('preserves node count', () => {
    // 1 frame + 1 rect + 1 text + 1 ellipse + 1 rect on page 2 = 5
    expect(reImportedNodes.length).toBe(5)
  })

  test('preserves node types', () => {
    const types = countByType(reImportedNodes)
    expect(types.get('FRAME')).toBe(1)
    expect(types.get('RECTANGLE')).toBe(2)
    expect(types.get('TEXT')).toBe(1)
    expect(types.get('ELLIPSE')).toBe(1)
  })

  test('preserves node names', () => {
    const names = new Set(reImportedNodes.map((n) => n.name))
    expect(names.has('Container')).toBe(true)
    expect(names.has('Header BG')).toBe(true)
    expect(names.has('Title')).toBe(true)
    expect(names.has('Circle')).toBe(true)
    expect(names.has('Page2 Rect')).toBe(true)
  })

  test('preserves fills', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')
    expect(headerBg).toBeDefined()
    expect(expectDefined(headerBg, 'headerBg').fills).toHaveLength(2)
    expect(headerBg.fills[0].type).toBe('SOLID')
    expect(headerBg.fills[0].color.r).toBeCloseTo(0.2, 1)
    expect(headerBg.fills[1].type).toBe('GRADIENT_LINEAR')
    expect(headerBg.fills[1].opacity).toBeCloseTo(0.5, 1)
    expect(headerBg.fills[1].gradientStops).toHaveLength(2)
  })

  test('preserves text content', () => {
    const title = reImportedNodes.find((n) => n.name === 'Title')
    expect(title).toBeDefined()
    expect(expectDefined(title, 'title').text).toBe('Hello World')
  })

  test('preserves text properties', () => {
    const title = reImportedNodes.find((n) => n.name === 'Title')
    expect(title).toBeDefined()
    expect(expectDefined(title, 'title').fontSize).toBe(18)
    expect(title.fontFamily).toBe('Inter')
    expect(title.fontWeight).toBe(700)
    expect(title.textAlignHorizontal).toBe('CENTER')
  })

  test('preserves layout mode', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')
    expect(container).toBeDefined()
    expect(expectDefined(container, 'container').layoutMode).toBe('VERTICAL')
  })

  test('preserves layout spacing', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')
    expect(container).toBeDefined()
    expect(expectDefined(container, 'container').itemSpacing).toBe(16)
    expect(container.paddingTop).toBe(24)
    expect(container.paddingRight).toBe(24)
    expect(container.paddingBottom).toBe(24)
    expect(container.paddingLeft).toBe(24)
  })

  test('preserves corner radius', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')
    expect(container).toBeDefined()
    expect(expectDefined(container, 'container').cornerRadius).toBe(12)
  })

  test('preserves independent corner radii', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')
    expect(headerBg).toBeDefined()
    expect(expectDefined(headerBg, 'headerBg').independentCorners).toBe(true)
    expect(headerBg.topLeftRadius).toBe(8)
    expect(headerBg.topRightRadius).toBe(8)
    expect(headerBg.bottomRightRadius).toBe(0)
    expect(headerBg.bottomLeftRadius).toBe(0)
  })

  test('preserves effects', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')
    expect(headerBg).toBeDefined()
    expect(expectDefined(headerBg, 'headerBg').effects).toHaveLength(1)
    expect(headerBg.effects[0].type).toBe('DROP_SHADOW')
    expect(headerBg.effects[0].radius).toBe(8)
    expect(headerBg.effects[0].offset.y).toBe(4)
  })

  test('preserves dimensions', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')
    expect(container).toBeDefined()
    expect(expectDefined(container, 'container').width).toBe(400)
    expect(container.height).toBe(300)
  })
})
