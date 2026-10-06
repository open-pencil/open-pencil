import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'
import raw from 'unplugin-raw/rolldown'

const packageJSON = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
}

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.d.ts'],
  // Prompts and the authoring reference import Markdown as text.
  plugins: [raw()],
  unbundle: true,
  platform: 'neutral',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: './dist',
  deps: {
    neverBundle: [...Object.keys(packageJSON.dependencies ?? {}), /^node:/],
    onlyBundle: false
  }
})
