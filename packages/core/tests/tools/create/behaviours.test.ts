import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

function tool(name: string) {
  const found = ALL_TOOLS.find((item) => item.name === name)
  if (!found) throw new Error(`No tool ${name}`)
  return (figma: FigmaAPI, args: Record<string, unknown>) => found.execute(figma, args)
}
const createSlot = { execute: tool('create_slot') }
const setBehaviour = { execute: tool('set_behaviour') }
const getBehaviour = { execute: tool('get_behaviour') }

/** A component with a Checked BOOLEAN property and a Box frame, as an agent finds it. */
function checkbox() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const component = figma.createComponent()
  component.name = 'Checkbox'
  component.addComponentProperty('Checked', 'BOOLEAN', false)
  const box = figma.createFrame()
  box.name = 'Box'
  component.appendChild(box)
  return { figma, component, box }
}

describe('behaviour tools', () => {
  test('an agent makes a slot, binds a behaviour by name, and reads it back', () => {
    const { figma, component, box } = checkbox()
    expect(createSlot.execute(figma, { id: box.id })).toEqual({ slot: 'Box' })
    expect(
      setBehaviour.execute(figma, {
        id: component.id,
        behaviour: { kind: 'checkbox', values: { value: 'Checked' }, parts: { indicator: 'Box' } }
      })
    ).toMatchObject({ kind: 'checkbox', parts: { indicator: 'Box' }, missing: [] })
    expect(getBehaviour.execute(figma, { id: component.id })).toMatchObject({
      values: { value: 'Checked' }
    })
    expect(setBehaviour.execute(figma, { id: component.id, behaviour: null })).toEqual({ ok: true })
    expect(getBehaviour.execute(figma, { id: component.id })).toEqual({ behaviour: null })
  })

  test('mistakes come back as errors naming what exists, and kinds are listed without an ID', () => {
    const { figma, component } = checkbox()
    expect(
      setBehaviour.execute(figma, {
        id: component.id,
        behaviour: { kind: 'checkbox', values: { value: 'State' } }
      })
    ).toEqual({
      error: 'value needs a VARIANT or BOOLEAN property named "State"; the component has "Checked"'
    })
    expect(JSON.stringify(getBehaviour.execute(figma, {}))).toContain('"kind":"accordion"')
  })
})
