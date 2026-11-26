import valueParser, { type Node } from 'postcss-value-parser'

function nodesOf(text: string): Node[] {
  return valueParser(text.trim()).nodes
}

function nameIn(node: Node): string | null {
  if (node.type !== 'function' || node.value.toLowerCase() !== 'var') return null
  const name = node.nodes.at(0)
  return name?.type === 'word' ? name.value : null
}

/** The custom property a value is, when it is exactly `var(--name)`, with or without a fallback. */
export function referencedProperty(text: string | undefined): string | null {
  const nodes = text ? nodesOf(text) : []
  return nodes.length === 1 ? nameIn(nodes[0]) : null
}

/** Every custom property a value names. */
export function propertiesIn(text: string): string[] {
  const names: string[] = []
  valueParser(text).walk((node) => {
    const name = nameIn(node)
    if (name) names.push(name)
  })
  return names
}

/**
 * The part of a value that is its color, as `var(--border)` in `1px solid var(--border)`: the one
 * part that names a color property, or null when none or several do.
 */
export function colorPart(text: string, isColor: (property: string) => boolean): string | null {
  const parts = nodesOf(text)
    .map((node) => valueParser.stringify(node))
    .filter((part) => propertiesIn(part).some(isColor))
  return parts.length === 1 ? parts[0] : null
}

/** A function's arguments, the nodes between its commas, spaces and comments left out. */
function argumentsOf(node: Node & { type: 'function' }): Node[][] {
  const parts: Node[][] = [[]]
  for (const child of node.nodes) {
    if (child.type === 'div' && child.value === ',') parts.push([])
    else if (child.type !== 'space' && child.type !== 'comment') parts[parts.length - 1].push(child)
  }
  return parts
}

/**
 * `color-mix(in oklab, var(--primary) 80%, transparent)`, how CSS writes a color's opacity: the
 * property and its percentage.
 */
function transparentMix(text: string): { property: string; percentage: string } | null {
  const nodes = nodesOf(text)
  const [mix] = nodes
  if (nodes.length !== 1 || mix.type !== 'function' || mix.value.toLowerCase() !== 'color-mix')
    return null
  // `in <space>`, then the color and its percentage, then `transparent`.
  const parts = argumentsOf(mix)
  if (parts.length !== 3) return null
  const [, mixed, other] = parts
  if (mixed.length !== 2 || other.length !== 1) return null
  const [color, percentage] = mixed
  const property = nameIn(color)
  const share = percentage.type === 'word' ? valueParser.unit(percentage.value) : false
  const transparent = other[0].type === 'word' && other[0].value.toLowerCase() === 'transparent'
  if (!property || !share || share.unit !== '%' || !transparent) return null
  return { property, percentage: percentage.value }
}

/**
 * How a value reads as a variable's name: `var(--primary)` is `primary`, and at 80% opacity
 * `primary 80%`; any other value has no name of its own.
 */
export function expressionLabel(text: string): string | null {
  const mix = transparentMix(text)
  if (mix) return `${propertyName(mix.property)} ${mix.percentage}`
  const property = referencedProperty(text)
  return property ? propertyName(property) : null
}

/** A custom property's name without its dashes, as its variable is named. */
export function propertyName(property: string): string {
  return property.slice(2)
}
