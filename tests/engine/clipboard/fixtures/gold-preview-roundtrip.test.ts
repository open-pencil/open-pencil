import { beforeAll, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

import {
  buildFigmaClipboardHTML,
  buildOpenPencilClipboardHTML,
  importClipboardNodes,
  parseFigmaClipboard,
  parseOpenPencilClipboard,
  readFigFile,
  initCodec,
  type SceneNode,
  SceneGraph
} from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

describe('gold-preview.fig clipboard roundtrip', () => {
  let graph: SceneGraph
  let pageId: string
  let topLevelNodes: SceneNode[]

  function flatten(g: SceneGraph, parentId: string): SceneNode[] {
    const res: SceneNode[] = []
    for (const c of g.getChildren(parentId)) {
      res.push(c)
      res.push(...flatten(g, c.id))
    }
    return res
  }

  beforeAll(async () => {
    await initCodec()
    const buf = readFileSync('tests/fixtures/gold-preview.fig')
    const file = new File([buf], 'gold-preview.fig')
    graph = await readFigFile(file)
    const page = graph.getPages()[0]
    pageId = page.id
    topLevelNodes = graph.getChildren(pageId)
  })

  it('OpenPencil format: zero property differences', () => {
    const html = buildOpenPencilClipboardHTML(topLevelNodes, graph)
    const parsed = parseOpenPencilClipboard(html)
    const clipboard = expectDefined(parsed, 'OpenPencil clipboard')

    const origAll = flatten(graph, pageId)

    function flattenClipboard(nodes: Array<SceneNode & { children?: SceneNode[] }>): SceneNode[] {
      const res: SceneNode[] = []
      for (const n of nodes) {
        res.push(n)
        if (n.children) res.push(...flattenClipboard(n.children))
      }
      return res
    }
    const pastedAll = flattenClipboard(
      clipboard.nodes as Array<SceneNode & { children?: SceneNode[] }>
    )

    expect(pastedAll.length).toBe(origAll.length)

    const SKIP = new Set(['id', 'parentId', 'childIds', 'children', 'textPicture'])
    let diffs = 0
    for (let i = 0; i < origAll.length; i++) {
      const o = origAll[i]
      const p = pastedAll[i]
      for (const k of Object.keys(o) as (keyof SceneNode)[]) {
        if (SKIP.has(k)) continue
        if (JSON.stringify(o[k]) !== JSON.stringify(p[k])) diffs++
      }
    }
    expect(diffs).toBe(0)
  })

  it('OpenPencil format: compressed data is under 1MB', () => {
    const html = buildOpenPencilClipboardHTML(topLevelNodes, graph)
    expect(html.length).toBeLessThan(1024 * 1024)
  })

  it('Figma format: preserves node count, clipsContent, constraints, arcData, layoutAlignSelf', async () => {
    const html = await buildFigmaClipboardHTML(topLevelNodes, graph)
    expect(html).not.toBeNull()

    const parsed = await parseFigmaClipboard(expectDefined(html, 'Figma clipboard html'))
    const clipboard = expectDefined(parsed, 'Figma clipboard')

    const graph2 = new SceneGraph()
    const page2 = graph2.getPages()[0]
    importClipboardNodes(clipboard.nodes, graph2, page2.id, 0, 0, clipboard.blobs)

    const origAll = flatten(graph, pageId)
    const pastedAll = flatten(graph2, page2.id)

    expect(pastedAll.length).toBe(origAll.length)

    const errors: string[] = []
    for (let i = 0; i < Math.min(origAll.length, pastedAll.length); i++) {
      const o = origAll[i]
      const p = pastedAll[i]
      if (o.name !== p.name) continue

      if (p.clipsContent !== o.clipsContent)
        errors.push(
          `clipsContent: ${o.type} "${o.name}" expected ${o.clipsContent}, got ${p.clipsContent}`
        )
      if (p.horizontalConstraint !== o.horizontalConstraint)
        errors.push(
          `horizontalConstraint: "${o.name}" expected ${o.horizontalConstraint}, got ${p.horizontalConstraint}`
        )
      if (p.verticalConstraint !== o.verticalConstraint)
        errors.push(
          `verticalConstraint: "${o.name}" expected ${o.verticalConstraint}, got ${p.verticalConstraint}`
        )
      if (p.layoutAlignSelf !== o.layoutAlignSelf)
        errors.push(
          `layoutAlignSelf: "${o.name}" expected ${o.layoutAlignSelf}, got ${p.layoutAlignSelf}`
        )
      if ((p.arcData != null) !== (o.arcData != null))
        errors.push(`arcData: "${o.name}" expected ${o.arcData != null}, got ${p.arcData != null}`)
    }
    if (errors.length > 0) throw new Error(`${errors.length} mismatches:\n${errors.join('\n')}`)
  })
})
