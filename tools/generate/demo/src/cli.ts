import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { buildDemoDocument } from './build'

/**
 * Writes the tour to a file, to look at locally: `bun run generate:demo <output.fig>`. The gallery
 * publishes it from `tools/ci/cloud-examples`; the app and the docs landing open it from Cloud.
 */
const [output] = process.argv.slice(2)
if (!output) throw new Error('Usage: bun run generate:demo <output.fig>')
const path = resolve(process.env.INIT_CWD ?? process.cwd(), output)
await mkdir(dirname(path), { recursive: true })
await writeFile(path, await buildDemoDocument())
console.info(`Wrote the tour to ${path}`)
