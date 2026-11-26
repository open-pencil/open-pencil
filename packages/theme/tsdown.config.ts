import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig({
  ...libraryConfig({ entry: { index: './src/index.ts' } }),
  // The tokens ship as they are, for a consumer's own Tailwind build to import; their `@source`
  // then finds the configs' classes in the built files beside them.
  copy: [{ from: 'src/tokens.css', to: 'dist' }]
})
