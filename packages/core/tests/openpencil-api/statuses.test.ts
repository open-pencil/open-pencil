import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import { STATUS_WORKFLOW_PRESETS, writeStatusWorkflow } from '@open-pencil/scene-graph/statuses'

/** A document with the design review statuses and a Checkout section holding a Cart frame. */
async function document() {
  const graph = new SceneGraph()
  writeStatusWorkflow(graph, STATUS_WORKFLOW_PRESETS.review)
  const figma = new FigmaAPI(graph)
  const ids = await compileScript(`
    const section = figma.createSection()
    section.name = 'Checkout'
    const cart = figma.createFrame()
    cart.name = 'Cart'
    section.appendChild(cart)
    const box = figma.createRectangle()
    figma.currentPage.appendChild(box)
    return { section: section.id, cart: cart.id, box: box.id }
  `)(figma)
  if (!ids || typeof ids !== 'object') throw new Error('No layers')
  return { figma, ...(ids as { section: string; cart: string; box: string }) }
}

describe('openpencil statuses', () => {
  test('a script lists the statuses and sets one by name', async () => {
    const { figma, section } = await document()
    const result = await compileScript(`
      const names = openpencil.statuses.map((status) => status.name)
      openpencil.setStatus(${JSON.stringify(section)}, 'Approved')
      return { names, approved: openpencil.getStatus(${JSON.stringify(section)}), ready: openpencil.statuses.find((status) => status.figma === 'READY_FOR_DEV').name }
    `)(figma)
    expect(result).toEqual({
      names: STATUS_WORKFLOW_PRESETS.review.states.map((state) => state.name),
      approved: 'Approved',
      ready: 'Ready for dev'
    })
  })

  test('a status hidden by a section around the layer reads as null', async () => {
    const { figma, section, cart } = await document()
    const result = await compileScript(`
      openpencil.setStatus(${JSON.stringify(cart)}, 'Draft')
      openpencil.setStatus(${JSON.stringify(section)}, 'Approved')
      const hidden = openpencil.getStatus(${JSON.stringify(cart)})
      openpencil.setStatus(${JSON.stringify(section)}, null)
      return { hidden, shown: openpencil.getStatus(${JSON.stringify(cart)}) }
    `)(figma)
    expect(result).toEqual({ hidden: null, shown: 'Draft' })
  })

  test('errors name the statuses there are and say why a layer cannot have one', async () => {
    const { figma, section, box } = await document()
    const run = (body: string) => compileScript(body)(figma)
    expect(run(`openpencil.setStatus(${JSON.stringify(section)}, 'Done')`)).rejects.toThrow(
      'No status named Done; the document has Draft, In review'
    )
    expect(run(`openpencil.setStatus(${JSON.stringify(box)}, 'Draft')`)).rejects.toThrow(
      'only sections, frames, components, component sets and instances can'
    )
  })
})
