import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

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

setDefaultTimeout(60_000)

let parsed: SceneGraph
let allNodes: SceneNode[]

beforeAll(async () => {
  const fixture = await parseGoldPreviewFixture()
  parsed = fixture.graph
  allNodes = fixture.allNodes
})

describe('derived instance layout regressions', () => {
  let layoutGraph: SceneGraph
  let layoutNodes: SceneNode[]

  beforeAll(async () => {
    layoutGraph = await parseFixture('gold-preview.fig')
    computeAllLayouts(layoutGraph)
    layoutNodes = collectAllNodes(layoutGraph)
  })

  test('preserves repeated badge overrides without moving sibling component wrappers', () => {
    const input = previewChild(layoutGraph, layoutNodes, 'Input')
    const inputRoot = childNamed(layoutGraph, input, '_input')
    const inputFrame = childNamed(layoutGraph, inputRoot, 'Input')
    const content = childNamed(layoutGraph, inputFrame, 'Content')
    const tags = childNamed(layoutGraph, content, 'Tags')
    const firstBadge = childNamed(layoutGraph, tags, 'Badge')
    const firstBadgeContent = childNamed(layoutGraph, firstBadge, '_badge-and-tag')
    const placeholderFrame = childNamed(layoutGraph, content, 'Placeholder')
    const placeholderText = childNamed(layoutGraph, placeholderFrame, 'Placeholder')

    expect(inputFrame).toMatchObject({ x: 0, y: 0 })
    expect(inputFrame?.width).toBeCloseTo(375.7498, 3)
    expect(inputFrame?.height).toBeCloseTo(39.3803, 3)
    expect(content).toMatchObject({ x: 0, y: 0 })
    expect(firstBadge?.x).toBeCloseTo(7.1268, 3)
    expect(firstBadge?.y).toBeCloseTo(5.3451, 3)
    expect(firstBadge?.width).toBeCloseTo(85.3239, 3)
    expect(firstBadge?.height).toBeCloseTo(28.6901, 3)
    expect(firstBadgeContent).toMatchObject({ x: 0, y: 0 })
    expect(placeholderFrame?.x).toBeCloseTo(277.352, 3)
    expect(placeholderFrame?.y).toBeCloseTo(0, 3)
    expect(placeholderText?.x).toBeCloseTo(14.2535, 3)
    expect(placeholderText?.y).toBeCloseTo(10.6901, 3)
  })

  test('does not collapse unrelated datepicker instances to the page origin', () => {
    const datepicker = previewChild(layoutGraph, layoutNodes, '_datepicker')
    expect(datepicker?.x).toBeCloseTo(765.2428, 3)
    expect(datepicker?.y).toBeCloseTo(518, 3)
    expect(datepicker?.width).toBeCloseTo(362, 3)
    expect(datepicker?.height).toBeCloseTo(422, 3)
  })

  test('keeps checked-list icons aligned with labels', () => {
    const title = previewChild(layoutGraph, layoutNodes, 'Title + Description')
    const checkedList = childNamed(layoutGraph, title, 'Checked List')
    const listItems = checkedList ? layoutGraph.getChildren(checkedList.id) : []
    expect(listItems).toHaveLength(3)

    for (const item of listItems) {
      const list = childNamed(layoutGraph, item, '_list')
      const inline = childNamed(layoutGraph, list, 'Inline')
      const icon = childNamed(layoutGraph, inline, 'Static Icon')
      const content = childNamed(layoutGraph, inline, 'Content')
      const label = content
        ? layoutGraph.getChildren(content.id).find((node) => node.text)
        : undefined
      expect(icon?.y).toBeCloseTo(0, 3)
      expect(label?.y).toBeCloseTo(0, 3)
      expect(icon?.height).toBeCloseTo(label?.height ?? 0, 3)
    }
  })

  test('preserves WYSIWYG toolbar padding', () => {
    const wysiwyg = previewChild(layoutGraph, layoutNodes, '_WYSIWYG-editor')
    const toolbarRoot = childNamed(layoutGraph, wysiwyg, '_on-text-WYSIWYG-toolbar')
    const toolbar = childMatching(
      layoutGraph,
      toolbarRoot,
      (node) => node.name === 'Toolbar' && node.width === 286 && node.height === 48
    )
    const buttons = childMatching(
      layoutGraph,
      toolbar,
      (node) => node.name === 'Toolbar' && node.width === 270 && node.height === 32
    )
    expect(toolbar?.x).toBeCloseTo(0, 3)
    expect(toolbar?.y).toBeCloseTo(37, 3)
    expect(buttons?.x).toBeCloseTo(8, 3)
    expect(buttons?.y).toBeCloseTo(8, 3)
    expect(buttons?.width).toBeCloseTo(270, 3)
    expect(buttons?.height).toBeCloseTo(32, 3)
  })

  test('scales WYSIWYG icon vector geometry with nested instances', () => {
    const wysiwyg = previewChild(layoutGraph, layoutNodes, '_WYSIWYG-editor')
    const toolbarRoot = childNamed(layoutGraph, wysiwyg, '_on-text-WYSIWYG-toolbar')
    const toolbar = childMatching(
      layoutGraph,
      toolbarRoot,
      (node) => node.name === 'Toolbar' && node.width === 286 && node.height === 48
    )
    const buttons = childMatching(
      layoutGraph,
      toolbar,
      (node) => node.name === 'Toolbar' && node.width === 270 && node.height === 32
    )
    const linkButton = layoutGraph.getChildren(buttons?.id ?? '').find((node) => node.x === 136)
    const linkIcon = childNamed(layoutGraph, linkButton, 'link')
    const linkVectors = linkIcon ? layoutGraph.getChildren(linkIcon.id) : []

    expect(linkIcon?.width).toBeCloseTo(18, 3)
    expect(linkIcon?.height).toBeCloseTo(18, 3)
    for (const vector of linkVectors) {
      const xs = vector.vectorNetwork?.vertices.map((vertex) => vertex.x) ?? []
      const ys = vector.vectorNetwork?.vertices.map((vertex) => vertex.y) ?? []
      expect(Math.max(...xs)).toBeLessThanOrEqual(vector.width + 0.001)
      expect(Math.max(...ys)).toBeLessThanOrEqual(vector.height + 0.001)
    }
  })

  test('exports WYSIWYG and logo visual overflow instead of clipping to node boxes', () => {
    const wysiwyg = previewChild(layoutGraph, layoutNodes, '_WYSIWYG-editor')
    expect(wysiwyg).toBeDefined()
    const wysiwygBounds = wysiwyg ? computeContentBounds(layoutGraph, [wysiwyg.id]) : null
    expect(wysiwygBounds?.minX).toBeCloseTo(5, 3)
    expect(wysiwygBounds?.minY).toBeCloseTo(577, 3)
    expect(wysiwygBounds ? wysiwygBounds.maxX - wysiwygBounds.minX : 0).toBeCloseTo(294, 3)
    expect(wysiwygBounds ? wysiwygBounds.maxY - wysiwygBounds.minY : 0).toBeCloseTo(93, 3)

    const title = previewChild(layoutGraph, layoutNodes, 'Title + Description')
    const logoGroup = childNamed(
      layoutGraph,
      childNamed(layoutGraph, title, 'Logo'),
      'logo-short-6'
    )
    expect(logoGroup).toBeDefined()
    const logoBounds = logoGroup ? computeContentBounds(layoutGraph, [logoGroup.id]) : null
    const logoAbs = logoGroup ? layoutGraph.getAbsolutePosition(logoGroup.id) : { x: 0, y: 0 }
    const logo = logoGroup
    expect(logoBounds?.minX).toBeLessThan(logoAbs.x)
    expect(logoBounds?.minY).toBeLessThan(logoAbs.y)
    expect(logoBounds?.maxX).toBeGreaterThan(logoAbs.x + (logo?.width ?? 0))
    expect(logoBounds?.maxY).toBeGreaterThan(logoAbs.y + (logo?.height ?? 0))
  })
})
