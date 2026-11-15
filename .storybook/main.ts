import type { StorybookConfig } from '@storybook/vue3-vite'
import type { PluginOption } from 'vite'

import { ensureBrandAssets } from '@open-pencil/brand-tools'

function flattenPlugins(plugins: PluginOption[]): PluginOption[] {
  return plugins.flatMap((plugin) => (Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin]))
}

await ensureBrandAssets(['web'])

const config: StorybookConfig = {
  staticDirs: ['../public'],
  stories: ['../src/**/*.stories.@(js|ts)', '../packages/vue/src/**/*.stories.@(js|ts)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/vue3-vite',
    options: { docgen: false }
  },
  viteFinal(config) {
    // Storybook's template plugin aliases `vue` as a prefix, which sends `vue/server-renderer`,
    // what email previews render with, to the compiling build too; the alias below replaces it.
    const excludedPluginPrefixes = [
      'open-pencil-automation',
      'vite-plugin-pwa',
      'storybook:vue-template-compilation'
    ]

    config.plugins = flattenPlugins(config.plugins ?? []).filter((plugin) => {
      if (!plugin || typeof plugin !== 'object' || !('name' in plugin)) return true
      return !excludedPluginPrefixes.some((prefix) => plugin.name.startsWith(prefix))
    })
    const aliases = config.resolve?.alias ?? []
    config.resolve = {
      ...config.resolve,
      alias: [
        // Stories' templates compile in the browser, so `vue` itself is the compiling build.
        { find: /^vue$/, replacement: 'vue/dist/vue.esm-bundler.js' },
        ...(Array.isArray(aliases)
          ? aliases
          : Object.entries(aliases).map(([find, replacement]) => ({ find, replacement })))
      ]
    }
    return config
  }
}

export default config
