import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { importSVG } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

async function importVectors(svg: string) {
  const graph = new SceneGraph()
  await importSVG.execute(new FigmaAPI(graph), { svg })
  return { graph, vectors: [...graph.nodes.values()].filter((node) => node.type === 'VECTOR') }
}

describe('SVG vector placement', () => {
  test('keeps stroke caps and joins after a .fig round trip', async () => {
    const { graph } = await importVectors(
      '<svg viewBox="0 0 24 24"><path d="M8 2v4m8-4v4" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="bevel"/></svg>'
    )

    const bytes = await exportFigFile(graph)
    const reopened = await parseFigFile(bytes.buffer as ArrayBuffer)
    const vector = expectDefined(
      [...reopened.nodes.values()].find((node) => node.type === 'VECTOR'),
      'reopened vector'
    )

    expect(vector.strokeCap).toBe('ROUND')
    expect(vector.strokeJoin).toBe('BEVEL')
    expect(vector.strokes.map(({ cap, join }) => ({ cap, join }))).toEqual([
      { cap: 'ROUND', join: 'BEVEL' }
    ])
  })

  test('fills open subpaths of a filled path but does not stroke their closing edges', async () => {
    const ring = 'M0 0h24v24H0M6 6v12h12V6z'
    const { vectors } = await importVectors(
      `<svg viewBox="0 0 24 24"><path d="${ring}"/><path d="${ring}" stroke="#000"/></svg>`
    )
    const [filled, stroked] = vectors.map((vector) => expectDefined(vector.vectorNetwork))

    expect(filled.regions.flatMap((region) => region.loops)).toHaveLength(2)
    expect(stroked.regions.flatMap((region) => region.loops)).toHaveLength(1)
  })
})
