import { describe, expect, it } from 'bun:test'

import { renderJSX } from '@open-pencil/core/design-jsx'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'
import { makeSceneGraph } from '@open-pencil/test-support/scene'

/** The layer `jsx` renders, and what the render reported. */
async function rendered(jsx: string): Promise<{ node: SceneNode; warnings: string[] }> {
  const graph = makeSceneGraph()
  const [result] = await renderJSX(graph, jsx)
  return { node: getNodeOrThrow(graph, result.id), warnings: result.warnings ?? [] }
}

describe('a layer prop of the wrong kind', () => {
  it('leaves a name that is not a string out, as the warning says', async () => {
    const { node, warnings } = await rendered('<Frame name={9} w={10} h={10} />')
    expect(node.name).toBe('Frame')
    expect(warnings).toEqual(['Invalid name 9 on <frame> is ignored; expected string.'])
  })

  it('leaves an artwork label that is not a string out', async () => {
    const { node, warnings } = await rendered(
      '<svg viewBox="0 0 24 24" label={9}><path d="M2 2h20v20H2z" /></svg>'
    )
    expect(typeof node.name).toBe('string')
    expect(warnings).toEqual(['Invalid label 9 on <svg> is ignored; expected string.'])
  })

  it('leaves opacity, rotation, a corner, and a stroke weight that are not numbers out', async () => {
    const { node, warnings } = await rendered(
      '<Rectangle w={10} h={10} opacity="50%" rotate="45" roundedTL="4" stroke="#000000" strokeWidth="2" />'
    )
    expect({
      opacity: node.opacity,
      rotation: node.rotation,
      independentCorners: node.independentCorners,
      strokeWeight: node.strokes[0]?.weight
    }).toEqual({ opacity: 1, rotation: 0, independentCorners: false, strokeWeight: 1 })
    expect(warnings).toEqual([
      'Invalid opacity "50%" on <rectangle> is ignored; expected number.',
      'Invalid rotate "45" on <rectangle> is ignored; expected number.',
      'Invalid roundedTL "4" on <rectangle> is ignored; expected number.',
      'Invalid strokeWidth "2" on <rectangle> is ignored; expected number.'
    ])
  })

  it('warns of a style value of the wrong kind, as the prop it stands for', async () => {
    const { node, warnings } = await rendered(
      '<Rectangle w={10} h={10} style={{ opacity: "bad" }} />'
    )
    expect(node.opacity).toBe(1)
    expect(warnings).toEqual(['Invalid opacity "bad" on <rectangle> is ignored; expected number.'])
  })

  it('lets a prop override its style value', async () => {
    const { node, warnings } = await rendered(
      '<Rectangle w={10} h={10} opacity={0.5} style={{ opacity: "bad" }} />'
    )
    expect(node.opacity).toBe(0.5)
    expect(warnings).toEqual([])
  })

  it('passes the attributes of an <svg> to its markup as written', async () => {
    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      '<svg viewBox="0 0 24 24" size={24} stroke="#000000" strokeWidth="2" fill="none"><line x1={2} y1={12} x2={22} y2={12} /></svg>'
    )
    const weights = graph.getChildren(result.id).map((path) => path.strokes[0]?.weight)
    expect(weights).toEqual([2])
    expect(result.warnings ?? []).toEqual([])
  })

  it('leaves a line limit that is not a whole number of lines out', async () => {
    for (const [maxLines, warning] of [
      ['"2"', 'Invalid maxLines "2" on <text> is ignored; expected number.'],
      ['{0}', 'Invalid maxLines 0 on <text> is ignored; expected >=1.']
    ]) {
      const { node, warnings } = await rendered(`<Text maxLines=${maxLines}>Hi</Text>`)
      expect({ maxLines: node.maxLines, truncation: node.textTruncation }).toEqual({
        maxLines: null,
        truncation: 'DISABLED'
      })
      expect(warnings).toEqual([warning])
    }
  })

  it('reports a prop an element reads by its own schema once', async () => {
    const { warnings } = await rendered('<Sticky name={9}>Hi</Sticky>')
    expect(warnings).toEqual(['Invalid name 9 on <sticky> is ignored; expected string.'])
  })
})

describe('a layer prop out of range', () => {
  it('bounds a radius and a corner smoothing, as layout bounds a size', async () => {
    const { node, warnings } = await rendered(
      '<Rectangle w={10} h={10} rounded={-4} cornerSmoothing={2} />'
    )
    expect({ radius: node.cornerRadius, smoothing: node.cornerSmoothing }).toEqual({
      radius: 0,
      smoothing: 1
    })
    expect(warnings).toEqual([])
  })
})
