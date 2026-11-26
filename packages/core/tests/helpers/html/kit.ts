import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** A small design system's theme and components, as a page marks them for import. */
export const THEME = `
  :root { --primary: #112233; --surface: #ffffff; --line: var(--primary); --radius: 8px; --scaled: calc(var(--radius) * 2) }
  .dark { --primary: #ddeeff; --surface: #000000 }
  button { display: flex; border: 1px solid transparent; border-radius: var(--radius); background: var(--primary); color: var(--surface) }
  button:hover { background: color-mix(in srgb, var(--primary) 50%, transparent) }
  button:focus-visible { border-color: var(--line); box-shadow: 0 0 #0000, 0 0 0 3px var(--primary) }
  .dark button.outline { border-color: var(--line) }
  div:has(> em) { opacity: 0.5 }
`

export const VARIABLES = {
  collection: 'Theme',
  modes: [{ name: 'Light' }, { name: 'Dark', rootAttributes: { class: 'dark' } }]
}

const button = (state: string, forced = '', className = '') =>
  `<button data-op-component="State=${state}" data-force-state="${forced}" class="${className}"><span data-op-text="Label">Save</span></button>`

export const KIT = `<div data-op-component-set="Button">${button('Rest')}${button('Hover', 'hover')}${button('Focus', 'focus-visible')}${button('Outline', '', 'outline')}</div>
  <section data-op-component="Card" style="padding:8px;background:var(--surface)"><div data-op-slot="Content" style="padding:4px"><p data-op-visible="Hint">Hi</p></div></section>`

export async function kit() {
  const { graph } = await readHTMLDocument(KIT, {
    cssText: THEME,
    variables: VARIABLES,
    components: true
  })
  return graph
}

export function named(graph: SceneGraph, name: string): SceneNode {
  const node = [...graph.getAllNodes()].find((candidate) => candidate.name === name)
  if (!node) throw new Error(`No ${name}`)
  return node
}

export function bound(graph: SceneGraph, node: SceneNode, field: string): string | undefined {
  const id = node.boundVariables[field]
  return id ? graph.variables.get(id)?.name : undefined
}

export function values(graph: SceneGraph, name: string) {
  const variable = [...graph.variables.values()].find((candidate) => candidate.name === name)
  if (!variable) throw new Error(`No variable ${name}`)
  const [collection] = graph.variableCollections.values()
  return collection.modes.map(({ modeId }) => variable.valuesByMode[modeId])
}
