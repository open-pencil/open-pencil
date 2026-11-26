// Builds the engine's WebAssembly module into wasm/, unless it is current with its sources.
//   bun scripts/wasm.ts [--check]
import { join } from 'node:path'

import { buildWasmModule } from '@open-pencil/package-artifacts-tools/wasm'

await buildWasmModule(
  {
    packageDir: join(import.meta.dir, '..'),
    library: 'open_pencil_html_engine',
    output: 'html-engine.wasm'
  },
  { check: process.argv.includes('--check') }
)
