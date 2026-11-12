import { icons as lucide } from '@iconify-json/lucide'

import { designJSXRenderer } from '@open-pencil/core/design-jsx'
import { createIconifyProvider } from '@open-pencil/core/icons'

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
      collections: { [lucide.prefix]: { name: 'Lucide', total: names.length, category: 'General' } }
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

/** Design JSX rendering with the bundled icons. */
export const { renderTree } = designJSXRenderer(createIconifyProvider(client))
