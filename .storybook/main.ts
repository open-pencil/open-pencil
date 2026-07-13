import type { StorybookConfig } from '@storybook/vue3-vite'
import type { PluginOption } from 'vite'

function flattenPlugins(plugins: PluginOption[]): PluginOption[] {
  return plugins.flatMap((plugin) => (Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin]))
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|ts)', '../packages/vue/src/**/*.stories.@(js|ts)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: {
        plugin: 'vue-component-meta',
        tsconfig: 'tsconfig.json'
      }
    }
  },
  viteFinal(config) {
    const excludedPluginPrefixes = [
      'copy-canvaskit-wasm',
      'open-pencil-automation',
      'vite-plugin-pwa'
    ]

    config.plugins = flattenPlugins(config.plugins ?? []).filter((plugin) => {
      if (!plugin || typeof plugin !== 'object' || !('name' in plugin)) return true
      return !excludedPluginPrefixes.some((prefix) => plugin.name.startsWith(prefix))
    })
    return config
  }
}

export default config
