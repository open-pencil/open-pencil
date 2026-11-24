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

/** `color-mix(in oklab, var(--primary) 80%, transparent)`, how CSS writes a color's opacity. */
function transparentMix(text: string): { property: string; percentage: string } | null {
  const nodes = nodesOf(text)
  const [mix] = nodes
  if (nodes.length !== 1 || mix.type !== 'function' || mix.value.toLowerCase() !== 'color-mix')
    return null
  const words = mix.nodes.filter((node) => node.type !== 'space' && node.type !== 'comment')
  // `in`, the color space, a comma, the color, its percentage, a comma, and the other color.
  if (words.length !== 7) return null
  const [, , , color, percentage, , other] = words
  const property = nameIn(color)
  if (!property || percentage.type !== 'word' || other.type !== 'word') return null
  if (!percentage.value.endsWith('%') || other.value.toLowerCase() !== 'transparent') return null
  return { property, percentage: percentage.value }
}

/** How a value reads as a variable's name: `--primary` is `primary`, at 80% `primary 80%`. */
export function expressionLabel(text: string): string {
  const mix = transparentMix(text)
  if (mix) return `${mix.property.replace(/^--/, '')} ${mix.percentage}`
  const property = referencedProperty(text)
  if (property) return property.replace(/^--/, '')
  // Figma takes neither braces nor dots in a variable's name.
  return text.replaceAll(/var\(\s*--([^),]+)\)/g, '$1').replaceAll('.', '_')
}
