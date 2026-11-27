import { describe, expect, test } from 'bun:test'

import { named } from '#core-tests/helpers/html/kit'

import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

const BUTTON = 'display:inline-flex;padding:6px 12px;border-radius:6px;font:14px sans-serif'
const LOOKS = { Primary: 'background:#111;color:#fff', Outline: 'border:1px solid #ccc;color:#111' }

function button(look: keyof typeof LOOKS, marks: string, label = 'Button', extra = '') {
  return `<button ${marks} style="${BUTTON};${LOOKS[look]}">${extra}${label}</button>`
}

const SET = `<div data-op-component-set="Button">
  ${button('Primary', 'data-op-component="Variant=Primary"')}
  ${button('Outline', 'data-op-component="Variant=Outline"')}
</div>`

function used(graph: SceneGraph, id: string): SceneNode {
  return named(graph, id)
}

async function page(body: string) {
  const { graph } = await readHTMLDocument(SET + body, { components: true })
  return graph
}

describe('instances a page marks', () => {
  test('are instances of the variant their marks pick, in the place of the element', async () => {
    const graph = await page(
      `<div id="row">${button('Outline', 'id="ok" data-op-instance="Button" data-op-variant="Variant=Outline"')}</div>`
    )
    const row = used(graph, 'row')
    const [instance] = graph.getChildren(row.id)
    expect(instance.type).toBe('INSTANCE')
    const main = instance.componentId ? graph.getNode(instance.componentId) : undefined
    expect(main?.componentPropertyValues).toEqual({ Variant: 'Outline' })
  })

  test('take the text they show as an override', async () => {
    const graph = await page(
      `<div id="row">${button('Primary', 'data-op-instance="Button" data-op-variant="Variant=Primary"', 'Submit')}</div>`
    )
    const [instance] = graph.getChildren(used(graph, 'row').id)
    expect(instance.type).toBe('INSTANCE')
    const text = graph
      .flattenTree(instance.id)
      .map(({ node }) => node)
      .find((node) => node.type === 'TEXT')
    expect(text?.text).toBe('Submit')
  })

  test('stay the layers they are where they draw something their variant does not', async () => {
    const icon = '<span style="display:block;width:8px;height:8px;background:red"></span>'
    const graph = await page(
      `<div id="row">${button('Primary', 'data-op-instance="Button" data-op-variant="Variant=Primary"', 'Go', icon)}${button('Primary', 'data-op-instance="Button" data-op-variant="Variant=Ghost"')}</div>`
    )
    const types = graph.getChildren(used(graph, 'row').id).map(({ type }) => type)
    expect(types).toEqual(['FRAME', 'FRAME'])
  })

  test('leave an element the page makes a component that component', async () => {
    const marked = `<div data-op-component-set="Chip">
      ${button('Primary', 'data-op-component="Variant=Primary" data-op-instance="Button" data-op-variant="Variant=Primary"')}
    </div>`
    const { graph: chips } = await readHTMLDocument(SET + marked, { components: true })
    const chip = [...chips.getAllNodes()].find((node) => node.name === 'Chip')
    expect(chip?.type).toBe('COMPONENT_SET')
    expect(chips.getChildren(chip?.id ?? '').map(({ type }) => type)).toEqual(['COMPONENT'])
  })

  test('name a component the page marks', async () => {
    await expect(
      page(`<button data-op-instance="Toggle" style="${BUTTON}">B</button>`)
    ).rejects.toThrow('The page marks an instance of Toggle, which it marks no component')
  })
})
