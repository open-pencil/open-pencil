import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { readBehaviour, SceneGraph } from '@open-pencil/scene-graph'

/** Run a script against a fresh document with a two-variant Switch set and a thumb frame. */
async function run(code: string) {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  await compileScript(`
    const off = figma.createComponent()
    off.name = 'State=Off'
    const on = figma.createComponent()
    on.name = 'State=On'
    const set = figma.combineAsVariants([off, on], figma.currentPage)
    set.name = 'Switch'
    const thumb = figma.createFrame()
    thumb.name = 'Thumb'
    off.appendChild(thumb)
  `)(figma)
  const set = graph.getAllNodes().find((node) => node.name === 'Switch')
  if (!set) throw new Error('No switch set')
  const result = await compileScript(code)(figma)
  return { graph, set, result }
}

describe('openpencil scripting API', () => {
  test('a script gives a component set a behaviour by property and slot names', async () => {
    const { graph, set, result } = await run(`
      const set = figma.currentPage.findOne((node) => node.name === 'Switch')
      const thumb = set.findOne((node) => node.name === 'Thumb')
      const behaviour = openpencil.setBehaviour(set, 'switch')
      behaviour.bindValue('value', 'State').bindPart('thumb', thumb)
      return { spec: behaviour.spec, missing: behaviour.missing }
    `)
    expect(result).toEqual({
      spec: {
        kind: 'switch',
        values: { value: { property: 'State', on: 'On', off: 'Off' } },
        parts: { thumb: 'Thumb' }
      },
      missing: []
    })
    expect(readBehaviour(graph.getNode(set.id) ?? set)?.kind).toBe('switch')
  })

  test('a variant reads its set’s behaviour, and removing it leaves the component alone', async () => {
    const { graph, set, result } = await run(`
      const set = figma.currentPage.findOne((node) => node.name === 'Switch')
      openpencil.setBehaviour(set, { kind: 'switch', values: { value: 'State' } })
      const variant = set.children[0]
      const kind = openpencil.getBehaviour(variant).kind
      openpencil.getBehaviour(set).remove()
      return [kind, openpencil.getBehaviour(set), openpencil.behaviourKinds.length]
    `)
    expect(result).toEqual(['switch', null, 15])
    expect(graph.getNode(set.id)?.componentPropertyDefinitions.map((item) => item.name)).toContain(
      'State'
    )
  })

  test('names the component lacks fail with what it has', async () => {
    await expect(
      run(`
        const set = figma.currentPage.findOne((node) => node.name === 'Switch')
        openpencil.setBehaviour(set, { kind: 'switch', values: { value: 'Checked' } })
      `)
    ).rejects.toThrow('named "Checked"; the component has "State"')
  })
})
