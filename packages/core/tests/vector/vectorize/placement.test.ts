import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import { importSVG } from '@open-pencil/core/tools'

async function importVectors(svg: string) {
  const graph = new SceneGraph()
  await importSVG.execute(new FigmaAPI(graph), { svg })
  return { vectors: [...graph.nodes.values()].filter((node) => node.type === 'VECTOR') }
}

describe('SVG vector placement', () => {
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
