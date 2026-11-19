import { describe, expect, test } from 'bun:test'

import { readHTMLDocument } from '#core/io/formats/html/import'

describe('boxes out of the flow inside text', () => {
  test('leave the text one layer that wraps, and become layers of their own', async () => {
    const { graph } = await readHTMLDocument(`<style>
      body { margin: 0 }
      .card { position: relative; width: 160px; padding: 10px; font: 16px/20px sans-serif }
      h3 { margin: 0 }
      .card a::before { content: ""; position: absolute; inset: 0 }
    </style>
    <div class="card"><h3><a href="/custom-domains">About custom domains and GitHub Pages</a></h3></div>`)
    const layers = graph.flattenTree(graph.getPages()[0].id).map(({ node }) => node)
    const title = layers.find((layer) => layer.type === 'TEXT')
    const overlay = layers.find((layer) => layer.name === '::before')

    // The title wraps within the card's 160px, as the link's stretched ::before takes no line.
    expect(title?.text).toBe('About custom domains and GitHub Pages')
    expect(title?.width).toBeLessThanOrEqual(160)
    expect(title?.height).toBeGreaterThan(20)
    expect(overlay).toMatchObject({ layoutPositioning: 'ABSOLUTE' })
  })
})
