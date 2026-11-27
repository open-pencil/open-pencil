import { describe, expect, test } from 'bun:test'

import { named } from '#core-tests/helpers/html/kit'

import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import { behaviourControls } from '@open-pencil/dom-css/export'
import { missingBindings, readBehaviour } from '@open-pencil/scene-graph/behaviours'

const TRACK = 'display:flex;width:32px;height:18px;padding:2px;border-radius:9px;border:0'
const THUMB = 'display:block;width:14px;height:14px;border-radius:7px;background:#fff'

function switchVariant(state: 'Off' | 'On', mark = 'Switch.Thumb') {
  const look = state === 'On' ? 'justify-content:flex-end;background:#111' : 'background:#ccc'
  return `<button data-op-component="State=${state}" data-op-reka="Switch.Root"
    data-op-behaviour='{"values":{"value":"State"}}' style="${TRACK};${look}">
    <span class="thumb" data-op-reka="${mark}" style="${THUMB}"></span>
  </button>`
}

describe('controls a page marks with Reka UI elements', () => {
  test('behave as that control, with their parts as its slots', async () => {
    const { graph } = await readHTMLDocument(
      `<div data-op-component-set="Switch">${switchVariant('Off')}${switchVariant('On')}</div>`,
      { components: true }
    )
    const set = named(graph, 'Switch')
    const behaviour = readBehaviour(set)
    const state = set.componentPropertyDefinitions.find(({ name }) => name === 'State')
    expect(behaviour).toMatchObject({
      kind: 'switch',
      booleans: { value: { propertyId: state?.id, on: 'On', off: 'Off' } }
    })
    if (!behaviour) throw new Error('No behaviour')
    expect(missingBindings(graph, set, behaviour)).toEqual([])

    // Preview finds the thumb in an instance, as it does for a switch built in the editor.
    const on = graph.getChildren(set.id).find(({ name }) => name === 'State=On')
    if (!on) throw new Error('No State=On')
    const instance = graph.createInstance(on.id, graph.getPages()[0].id)
    if (!instance) throw new Error('No instance')
    const [control] = behaviourControls(graph, instance.id).values()
    expect(control?.kind).toBe('switch')
    expect(Object.keys(control?.parts ?? {})).toEqual(['thumb'])
  })

  test('name each part after the element it is', async () => {
    const { graph } = await readHTMLDocument(
      `<div data-op-component-set="Switch">${switchVariant('Off')}${switchVariant('On')}</div>`,
      { components: true }
    )
    const set = named(graph, 'Switch')
    const thumbs = graph
      .getChildren(set.id)
      .map((variant) => graph.getChildren(variant.id)[0]?.name)
    expect(thumbs).toEqual(['Thumb', 'Thumb'])
  })

  test('refuse a part of another control, or one outside any', async () => {
    const other = `<div data-op-component-set="Switch">${switchVariant('Off', 'Slider.Thumb')}</div>`
    await expect(readHTMLDocument(other, { components: true })).rejects.toThrow(
      '<Slider.Thumb> must be inside a component marked Slider.Root'
    )
    const loose = `<div data-op-component="Box" style="width:10px;height:10px">
      <span data-op-reka="Switch.Thumb" style="${THUMB}"></span></div>`
    await expect(readHTMLDocument(loose, { components: true })).rejects.toThrow(
      '<Switch.Thumb> must be inside a component marked Switch.Root'
    )
  })

  test('refuse variants that bind the control differently', async () => {
    const off = switchVariant('Off')
    const on = switchVariant('On').replace(`'{"values":{"value":"State"}}'`, `'{}'`)
    await expect(
      readHTMLDocument(`<div data-op-component-set="Switch">${off}${on}</div>`, {
        components: true
      })
    ).rejects.toThrow('The variants of Switch mark different controls or bindings')
  })
})
