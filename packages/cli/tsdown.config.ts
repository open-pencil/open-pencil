import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      index: './src/index.ts',
      'commands/index': './src/commands/index.ts',
      'library/index': './src/library/index.ts'
    },
    // A Node program: chunks keep rolldown's hashed names, and nothing is shaken out.
    platform: 'node',
    treeshake: false,
    hash: true,
    chunks: 'default',
    // The MCP server ships inside the CLI; Core and CanvasKit are the CLI's dependencies.
    alwaysBundle: ['@open-pencil/mcp', /^@open-pencil\/mcp\//],
    neverBundle: ['@open-pencil/core', /^@open-pencil\/core\//, 'canvaskit-wasm']
  })
)
