// Builds the `.fig` reader crate's WebAssembly module into wasm/, unless it is current with its
// sources. Only the crate's tests load it so far.
//   bun scripts/wasm.ts [--check]
import { join } from 'node:path'

import { buildWasmModule } from '@open-pencil/package-artifacts-tools/wasm'

await buildWasmModule(
  {
    packageDir: join(import.meta.dir, '..'),
    library: 'open_pencil_fig',
    output: 'fig.wasm',
    // The raw functions the tests call, which a crate depending on this one leaves out.
    features: ['exports']
  },
  { check: process.argv.includes('--check') }
)
