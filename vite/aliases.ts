import { resolve } from 'node:path'

/**
 * The modules a build without Cloud (`VITE_OPENPENCIL_CLOUD=off`) uses instead of Cloud's two
 * entry points, so nothing else of Cloud is bundled. They precede the `@` alias, which would
 * otherwise resolve these paths first.
 */
function cloudOffAliases(rootDir: string) {
  return [
    {
      find: /^@\/app\/cloud\/integration$/,
      replacement: resolve(rootDir, 'src/app/cloud/integration/off/index.ts')
    },
    {
      find: /^@\/app\/cloud\/integration\/storage$/,
      replacement: resolve(rootDir, 'src/app/cloud/integration/off/storage.ts')
    },
    {
      find: /^@\/components\/cloud\/integration$/,
      replacement: resolve(rootDir, 'src/components/cloud/integration/off.ts')
    }
  ]
}

export function createOpenPencilAliases(rootDir: string, options: { cloud?: boolean } = {}) {
  const emptyNodeModule = resolve(rootDir, 'vite/empty-node-module.ts')

  return [
    { find: /^fs$/, replacement: emptyNodeModule },
    { find: /^path$/, replacement: emptyNodeModule },
    { find: /^node:process$/, replacement: resolve(rootDir, 'vite/node-process.ts') },
    ...(options.cloud === false ? cloudOffAliases(rootDir) : []),
    { find: '@', replacement: resolve(rootDir, 'src') },
    { find: '#vue', replacement: resolve(rootDir, 'packages/vue/src') },
    { find: '#core', replacement: resolve(rootDir, 'packages/core/src') },
    { find: '#dom-css', replacement: resolve(rootDir, 'packages/dom-css/src') },
    { find: '#scene-graph', replacement: resolve(rootDir, 'packages/scene-graph/src') },
    {
      find: /^@open-pencil\/dom-css\/browser$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/browser.ts')
    },
    {
      find: /^@open-pencil\/dom-css\/export$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/export/index.ts')
    },
    {
      find: /^@open-pencil\/dom-css\/scene-graph$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/import/scene-graph.ts')
    },
    {
      find: /^@open-pencil\/dom-css\/jsx-runtime$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/import/jsx/runtime.ts')
    },
    {
      find: /^@open-pencil\/dom-css\/jsx-dev-runtime$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/import/jsx/dev-runtime.ts')
    },
    {
      find: /^@open-pencil\/dom-css$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/index.ts')
    },
    {
      find: /^@open-pencil\/scene-graph$/,
      replacement: resolve(rootDir, 'packages/scene-graph/src/index.ts')
    },
    { find: '@open-pencil/scene-graph', replacement: resolve(rootDir, 'packages/scene-graph/src') },
    { find: '#cloud', replacement: resolve(rootDir, 'packages/cloud/src') },
    {
      find: /^@open-pencil\/cloud\/(contract|client)$/,
      replacement: resolve(rootDir, 'packages/cloud/src/$1/index.ts')
    },
    { find: '#emit', replacement: resolve(rootDir, 'packages/emit/src') },
    {
      find: /^@open-pencil\/emit$/,
      replacement: resolve(rootDir, 'packages/emit/src/index.ts')
    },
    { find: '#design-jsx', replacement: resolve(rootDir, 'packages/design-jsx/src') },
    {
      find: /^@open-pencil\/design-jsx$/,
      replacement: resolve(rootDir, 'packages/design-jsx/src/index.ts')
    },
    { find: /^@open-pencil\/pen$/, replacement: resolve(rootDir, 'packages/pen/src/index.ts') },
    { find: '@open-pencil/pen', replacement: resolve(rootDir, 'packages/pen/src') },
    { find: '@open-pencil/kiwi', replacement: resolve(rootDir, 'packages/kiwi/src') },
    { find: /^@open-pencil\/fig$/, replacement: resolve(rootDir, 'packages/fig/src/index.ts') },
    { find: '@open-pencil/fig', replacement: resolve(rootDir, 'packages/fig/src') },
    {
      find: /^@open-pencil\/mcp\/discovery$/,
      replacement: resolve(rootDir, 'packages/mcp/src/transport/discovery.ts')
    },
    {
      find: /^@open-pencil\/mcp\/transport$/,
      replacement: resolve(rootDir, 'packages/mcp/src/transport/paths.ts')
    },
    { find: /^@open-pencil\/vue$/, replacement: resolve(rootDir, 'packages/vue/src/index.ts') },
    { find: '@open-pencil/vue', replacement: resolve(rootDir, 'packages/vue/src') },
    // Bundled fonts ship beside the sources, not inside them.
    {
      find: /^@open-pencil\/core\/assets\//,
      replacement: `${resolve(rootDir, 'packages/core/assets')}/`
    },
    { find: /^@open-pencil\/core$/, replacement: resolve(rootDir, 'packages/core/src/index.ts') },
    { find: '@open-pencil/core', replacement: resolve(rootDir, 'packages/core/src') }
  ]
}
