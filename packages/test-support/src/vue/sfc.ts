import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { compileScript, parse } from 'vue/compiler-sfc'

/**
 * Teaches Bun to load Vue single-file components, as the bundlers do with `unplugin-vue`: preload
 * this module (`bunfig.toml`, or `bun --preload`) where tests or a Bun-run server import `.vue`
 * files. Each component compiles once, its template inlined into its setup function.
 */
Bun.plugin({
  name: 'vue-sfc',
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path })
      const [error] = errors
      if (error) throw error
      const id = createHash('sha256').update(path).digest('hex').slice(0, 8)
      return {
        contents: compileScript(descriptor, { id, inlineTemplate: true }).content,
        loader: 'ts'
      }
    })
  }
})
