import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { svgDataURL } from '@open-pencil/scene-graph/images'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { readHTMLDocument } from '#core/io/formats/html/import'

describe('pictures in imported HTML', () => {
  test('draws an SVG picture as vector layers at the size the page shows it', async () => {
    const logo =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="#0969da"/></svg>'
    const inline = svgDataURL(logo)
    const { graph } = await readHTMLDocument(
      `<img src="logo.svg" style="display:block;width:80px;height:40px"><img src="${inline}" style="display:block;width:40px;height:20px">`,
      { readAsset: async (path) => (path === 'logo.svg' ? new TextEncoder().encode(logo) : null) }
    )
    const [linked, written] = graph.getChildren(graph.getPages()[0].id)
    const vectors = (id: string) =>
      graph
        .flattenTree(id)
        .filter(({ node }) => node.type === 'VECTOR' || node.type === 'RECTANGLE')

    expect(linked).toMatchObject({ width: 80, height: 40 })
    expect(vectors(linked.id).length).toBeGreaterThan(0)
    expect(written).toMatchObject({ width: 40, height: 20 })
    expect(vectors(written.id).length).toBeGreaterThan(0)
  })
  test('a page from the web reads no file from the computer', async () => {
    const png = join(FIXTURES, 'absolute-constraint-figma.png')
    const fileURL = pathToFileURL(png).href
    const { graph } = await readHTMLDocument(
      `<link rel="stylesheet" href="${fileURL}"><img src="${fileURL}">`,
      { baseURL: 'https://site.example.test/' }
    )
    const [image] = graph.getChildren(graph.getPages()[0].id)

    expect(image.fills.some((paint) => paint.type === 'IMAGE')).toBe(false)
  })
  test('a page on disk shows the pictures beside it', async () => {
    const page = pathToFileURL(join(FIXTURES, 'page.html')).href
    const { graph } = await readHTMLDocument('<img src="absolute-constraint-figma.png">', {
      baseURL: page
    })
    const [image] = graph.getChildren(graph.getPages()[0].id)

    expect(image.fills[0]?.type).toBe('IMAGE')
  })
  test('fills an image layer with the picture its page links', async () => {
    const png = await Bun.file(join(FIXTURES, 'absolute-constraint-figma.png')).bytes()
    const requested: string[] = []
    const { graph } = await readHTMLDocument(
      '<img src="photo.png"><img src="photo.png"><img src="missing.png">',
      {
        readAsset: async (path) => {
          requested.push(path)
          return path === 'photo.png' ? png : null
        }
      }
    )
    const [first, second, missing] = graph.getChildren(graph.getPages()[0].id)
    const fill = first.fills[0]

    expect(fill?.type).toBe('IMAGE')
    expect(fill?.imageHash && graph.images.get(fill.imageHash)).toEqual(png)
    expect(second.fills[0]?.imageHash).toBe(fill?.imageHash)
    // A picture that cannot be read leaves its layer as the import made it.
    expect(missing.fills.some((paint) => paint.type === 'IMAGE')).toBe(false)
    // Each address is read once, however many images show it.
    expect(requested.filter((path) => path === 'photo.png')).toHaveLength(1)
  })

  test('fills a box with the pictures its background layers show, under the top layer', async () => {
    const png = await Bun.file(join(FIXTURES, 'absolute-constraint-figma.png')).bytes()
    const { graph } = await readHTMLDocument(
      `<div class="cover"></div><div class="tile"></div>
      <style>
        div { width: 200px; height: 100px }
        .cover { background: url(photo.png) center / cover, #2563eb }
        .tile { background-image: url(photo.png); background-repeat: repeat }
      </style>`,
      { readAsset: async (path) => (path === 'photo.png' ? png : null) }
    )
    const [cover, tile] = graph.getChildren(graph.getPages()[0].id)

    // The color stays the bottom fill and the picture paints over it, filling the box.
    expect(cover.fills.map((fill) => fill.type)).toEqual(['SOLID', 'IMAGE'])
    expect(cover.fills[1]).toMatchObject({ imageScaleMode: 'FILL' })
    expect(cover.fills[1]?.imageHash && graph.images.get(cover.fills[1].imageHash)).toEqual(png)
    // A picture repeated at its own size tiles the box.
    expect(tile.fills).toEqual([expect.objectContaining({ type: 'IMAGE', imageScaleMode: 'TILE' })])
  })
})
