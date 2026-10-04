import { parser } from '@lezer/javascript'

import type { JSXAttributeSource } from './export'

const elementParser = parser.configure({ dialect: 'jsx', top: 'SingleExpression' })

/**
 * Split JSX attributes, such as `w={200} bg="#FF0000"`, into each attribute as written.
 * Throws on a syntax error or a spread, whose props cannot be named.
 */
export function parseJSXAttributes(source: string): JSXAttributeSource[] {
  const element = `<Frame ${source} />`
  const tree = elementParser.parse(element)
  const attributes: JSXAttributeSource[] = []
  const invalid = () => new SyntaxError(`Invalid JSX attributes: ${source}`)
  tree.iterate({
    enter(node) {
      if (node.type.isError || node.name === 'JSXSpreadAttribute') throw invalid()
      if (node.name !== 'JSXAttribute') return undefined
      const key = node.node.firstChild
      if (key?.name !== 'JSXIdentifier') throw invalid()
      attributes.push({
        name: element.slice(key.from, key.to),
        source: element.slice(node.from, node.to)
      })
      return false
    }
  })
  return attributes
}
