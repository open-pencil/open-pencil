import { defineConfig } from 'tsdown'
import raw from 'unplugin-raw/rolldown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: ['src/**/*.ts', '!src/**/*.d.ts'],
    // Prompts and the authoring reference import Markdown as text.
    plugins: [raw()],
    chunks: 'unbundle',
    // Core's modules may run code when imported, so their imports keep their order.
    treeshake: true,
    // The runtime assets module's `?url` imports stay as written, for the host's Vite.
    neverBundle: [/\?url$/]
  })
)
