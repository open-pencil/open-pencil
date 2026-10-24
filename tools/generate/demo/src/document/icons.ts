import { icons as lucide } from '@iconify-json/lucide'

import { designJSXRenderer } from '@open-pencil/core/design-jsx'
import { createIconifyProvider } from '@open-pencil/core/icons'
import type { RenderOptions, TreeNode } from '@open-pencil/design-jsx'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { iconColors } from './elements'

type IconifyClient = NonNullable<Parameters<typeof createIconifyProvider>[0]>

const names = Object.keys(lucide.icons)

/** Lucide from the bundled icon JSON, so the demo builds without the Iconify API. */
const client: IconifyClient = {
  async fetchCollection(prefix, iconNames) {
    if (prefix !== lucide.prefix) throw new Error(`The demo bundles no "${prefix}" icons`)
    return {
      prefix,
      width: lucide.width,
      height: lucide.height,
      icons: Object.fromEntries(
        iconNames.flatMap((name) => {
          const icon = lucide.icons[name]
          return icon ? [[name, icon]] : []
        })
      )
    }
  },
  async search(query, options) {
    const needle = query.trim().toLowerCase()
    const found = names
      .filter((name) => name.includes(needle))
      .map((name) => `${lucide.prefix}:${name}`)
    return {
      icons: found.slice(0, options?.limit ?? 64),
      total: found.length,
      collections: {
        [lucide.prefix]: { name: 'Lucide', total: names.length, category: 'General' }
      }
    }
  },
  async collections() {
    return [
      {
        prefix: lucide.prefix,
        name: 'Lucide',
        total: names.length,
        category: 'General',
        license: 'ISC',
        multicolor: false
      }
    ]
  },
  async collectionIcons(prefix) {
    return prefix === lucide.prefix ? names.map((name) => `${prefix}:${name}`) : []
  }
}

const renderer = designJSXRenderer(createIconifyProvider(client))

/** Bind every solid paint of an icon's paths to `variableId`. */
function bindIcon(graph: SceneGraph, icon: SceneNode, variableId: string): void {
  const visit = (node: SceneNode): void => {
    for (const field of ['fills', 'strokes'] as const) {
      node[field].forEach((paint, index) => {
        if (paint.type === 'SOLID')
          graph.bindVariable(node.id, `${field}/${index}/color`, variableId)
      })
    }
    for (const child of graph.getChildren(node.id)) visit(child)
  }
  visit(icon)
}

/**
 * Design JSX rendering with the bundled icons. Icons from `Icon` in `./elements` are bound to
 * their color variable once drawn, so they follow the tour's modes like everything else.
 */
export function renderTree(
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions = {}
): ReturnType<typeof renderer.renderTree> {
  return renderer.renderTree(graph, tree, {
    ...options,
    onNode(element, node) {
      options.onNode?.(element, node)
      const variableId = iconColors.get(element)?.id
      if (variableId && graph.variables.has(variableId)) bindIcon(graph, node, variableId)
    }
  })
}
