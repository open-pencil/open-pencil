import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { defineConfig } from 'tsdown'
import raw from 'unplugin-raw/rolldown'
import vue from 'unplugin-vue/rolldown'

const require = createRequire(import.meta.url)

const packageJSON = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}
/** Bundled because their ES modules are `.js` files Node reads as CommonJS. */
const BUNDLED = ['@atlaskit/pragmatic-drag-and-drop', '@atlaskit/pragmatic-drag-and-drop-hitbox']
const external = Object.keys({ ...packageJSON.dependencies, ...packageJSON.peerDependencies })
  .filter((name) => !BUNDLED.includes(name))
  .flatMap((name) => [name, new RegExp(`^${name.replaceAll('/', '\\/')}/`)])

/**
 * Where an unbundled module is written: bundled packages would keep their install path under
 * `node_modules`, which installed copies of the package did not carry, so they go under `vendor/`.
 */
function outputPath(chunk: { name: string }): string {
  // A `?raw` import is a module of its own; its query would read as a URL query to Node.
  const source = chunk.name.replace(/\?.*$/, '')
  const vendored = source.lastIndexOf('node_modules/')
  const name = vendored < 0 ? source : `vendor/${source.slice(vendored + 'node_modules/'.length)}`
  return `${name}.js`
}

function atlaskitSubpathResolver() {
  const aliases = new Map([
    [
      '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item',
      '@atlaskit/pragmatic-drag-and-drop-hitbox/dist/esm/tree-item.js'
    ],
    [
      '@atlaskit/pragmatic-drag-and-drop/combine',
      '@atlaskit/pragmatic-drag-and-drop/dist/esm/entry-point/combine.js'
    ],
    [
      '@atlaskit/pragmatic-drag-and-drop/element/adapter',
      '@atlaskit/pragmatic-drag-and-drop/dist/esm/adapter/element-adapter.js'
    ]
  ])

  return {
    name: 'atlaskit-subpath-resolver',
    resolveId(id) {
      const target = aliases.get(id)
      return target ? require.resolve(target) : null
    }
  }
}

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'canvas/index': './src/canvas/index.ts',
    'canvas/drop/index': './src/canvas/drop/index.ts',
    'canvas/issues/index': './src/canvas/issues/index.ts',
    'canvas/labels/index': './src/canvas/labels/index.ts',
    'canvas/overlays/index': './src/canvas/overlays/index.ts',
    'canvas/statuses/index': './src/canvas/statuses/index.ts',
    'canvas/surface/index': './src/canvas/surface/index.ts',
    'canvas/text-edit/index': './src/canvas/text-edit/index.ts',
    'controls/appearance/index': './src/controls/appearance/index.ts',
    'controls/behaviour/index': './src/controls/behaviour/index.ts',
    'controls/binding-provider/index': './src/controls/binding-provider/index.ts',
    'controls/color-model/index': './src/controls/color-model/index.ts',
    'controls/color-variable-binding/index': './src/controls/color-variable-binding/index.ts',
    'controls/component-props/index': './src/controls/component-props/index.ts',
    'controls/connector/index': './src/controls/connector/index.ts',
    'controls/constraints/index': './src/controls/constraints/index.ts',
    'controls/effects/index': './src/controls/effects/index.ts',
    'controls/figjam-style/index': './src/controls/figjam-style/index.ts',
    'controls/fill/index': './src/controls/fill/index.ts',
    'controls/icon/index': './src/controls/icon/index.ts',
    'controls/layout/index': './src/controls/layout/index.ts',
    'controls/mask/index': './src/controls/mask/index.ts',
    'controls/node-props/index': './src/controls/node-props/index.ts',
    'controls/number-expression/index': './src/controls/number-expression/index.ts',
    'controls/number-variable-binding/index': './src/controls/number-variable-binding/index.ts',
    'controls/okhcl/index': './src/controls/okhcl/index.ts',
    'controls/position/index': './src/controls/position/index.ts',
    'controls/prop-scrub/index': './src/controls/prop-scrub/index.ts',
    'controls/property-list/index': './src/controls/property-list/index.ts',
    'controls/selection-colors/index': './src/controls/selection-colors/index.ts',
    'controls/selection-layout/index': './src/controls/selection-layout/index.ts',
    'controls/shader/index': './src/controls/shader/index.ts',
    'controls/shape-with-text/index': './src/controls/shape-with-text/index.ts',
    'controls/shared-style/index': './src/controls/shared-style/index.ts',
    'controls/slots/index': './src/controls/slots/index.ts',
    'controls/sticky/index': './src/controls/sticky/index.ts',
    'controls/stroke/index': './src/controls/stroke/index.ts',
    'controls/typography/index': './src/controls/typography/index.ts',
    'controls/variable-binding/index': './src/controls/variable-binding/index.ts',
    'controls/variable-modes/index': './src/controls/variable-modes/index.ts',
    'controls/variants/index': './src/controls/variants/index.ts',
    'document/export/index': './src/document/export/index.ts',
    'document/workspace/index': './src/document/workspace/index.ts',
    'editor/commands/index': './src/editor/commands/index.ts',
    'editor/events/index': './src/editor/events/index.ts',
    'editor/inline-rename/index': './src/editor/inline-rename/index.ts',
    'editor/menu-model/index': './src/editor/menu-model/index.ts',
    'editor/selection-capabilities/index': './src/editor/selection-capabilities/index.ts',
    'editor/selection-state/index': './src/editor/selection-state/index.ts',
    'editor/tool-cursor/index': './src/editor/tool-cursor/index.ts',
    'editor/viewport-kind/index': './src/editor/viewport-kind/index.ts',
    'i18n/index': './src/i18n/index.ts',
    'internal/scene-computed/index': './src/internal/scene-computed/index.ts',
    'lifecycle/retention/index': './src/lifecycle/retention/index.ts',
    'primitives/AppearanceControls/index': './src/primitives/AppearanceControls/index.ts',
    'primitives/BindableValue/index': './src/primitives/BindableValue/index.ts',
    'primitives/ChannelSlider/index': './src/primitives/ChannelSlider/index.ts',
    'primitives/ColorPicker/index': './src/primitives/ColorPicker/index.ts',
    'primitives/CommandPalette/index': './src/primitives/CommandPalette/index.ts',
    'primitives/ConstraintsControl/index': './src/primitives/ConstraintsControl/index.ts',
    'primitives/Fill/index': './src/primitives/Fill/index.ts',
    'primitives/FontPicker/index': './src/primitives/FontPicker/index.ts',
    'primitives/GradientEditor/index': './src/primitives/GradientEditor/index.ts',
    'primitives/LayerTree/index': './src/primitives/LayerTree/index.ts',
    'primitives/LayoutControls/index': './src/primitives/LayoutControls/index.ts',
    'primitives/NumberField/index': './src/primitives/NumberField/index.ts',
    'primitives/PageList/index': './src/primitives/PageList/index.ts',
    'primitives/PositionControls/index': './src/primitives/PositionControls/index.ts',
    'primitives/PropertyGrid/index': './src/primitives/PropertyGrid/index.ts',
    'primitives/PropertyList/index': './src/primitives/PropertyList/index.ts',
    'primitives/PropertySection/index': './src/primitives/PropertySection/index.ts',
    'primitives/SegmentedControl/index': './src/primitives/SegmentedControl/index.ts',
    'primitives/Toolbar/index': './src/primitives/Toolbar/index.ts',
    'primitives/TypographyControls/index': './src/primitives/TypographyControls/index.ts',
    'shared/dom-events': './src/shared/dom-events.ts',
    'shared/drag/index': './src/shared/drag/index.ts',
    'shared/font-status/index': './src/shared/font-status/index.ts',
    'shared/input/index': './src/shared/input/index.ts',
    'shared/search/index': './src/shared/search/index.ts',
    'testing/index': './src/testing/index.ts',
    'variables/index': './src/variables/index.ts'
  },
  // The workspace tsconfig maps Core to its source so unbuilt code runs under Bun; the build
  // resolves Core as a consumer does, so declarations import its types instead of copying them.
  tsconfig: 'tsconfig.build.json',
  platform: 'browser',
  format: ['esm'],
  dts: {
    vue: true,
    sourcemap: true
  },
  sourcemap: true,
  hash: false,
  clean: true,
  outDir: './dist',
  treeshake: {
    moduleSideEffects: false
  },
  deps: {
    alwaysBundle: BUNDLED.flatMap((name) => [name, new RegExp(`^${name.replaceAll('/', '\\/')}/`)]),
    neverBundle: [...external, /^node:/    ],
    onlyBundle: false
  },
  plugins: [atlaskitSubpathResolver(), raw(), vue()],
  inputOptions: {
    preserveEntrySignatures: 'allow-extension',
    checks: {
      pluginTimings: false
    }
  },
  outputOptions: {
    minifyInternalExports: false,
    entryFileNames: outputPath,
    chunkFileNames: outputPath
  },
  // Each module keeps its source path, so an entry's declarations never share a name with a chunk.
  unbundle: true
})
